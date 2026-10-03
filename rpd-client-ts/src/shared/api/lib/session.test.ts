import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  applySession,
  axiosAuth,
  axiosBase,
  beginSession,
  endSession,
  getSessionGeneration,
  refreshSession,
  SessionChangedError,
  subscribeToSession,
  type AuthSession,
} from "..";
import { getAccessToken } from "./session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function response(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200
): AxiosResponse {
  return { config, data, status, statusText: String(status), headers: {} };
}

function failure(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError(
    "Отказ",
    "ERR_BAD_RESPONSE",
    config,
    undefined,
    response(config, {}, status)
  );
}

const session: AuthSession = {
  accessToken: "new-token",
  accessTokenExpiration: 1800000,
  role: 3,
  fullname: { surname: "Руководов", name: "Тест", patronymic: "Тестович" },
};
const originalAuthAdapter = axiosAuth.defaults.adapter;
const originalApiAdapter = axiosBase.defaults.adapter;
let unsubscribe: () => void;
let expired = vi.fn<() => void>();
let refreshed = vi.fn<(session: AuthSession) => void>();

describe("единый refresh сессии", () => {
  beforeEach(() => {
    beginSession();
    applySession(
      { ...session, accessToken: "old-token" },
      getSessionGeneration()
    );
    expired = vi.fn<() => void>();
    refreshed = vi.fn<(session: AuthSession) => void>();
    unsubscribe = subscribeToSession({
      onExpired: expired,
      onRefreshed: refreshed,
    });
  });

  afterEach(() => {
    unsubscribe();
    endSession();
    axiosAuth.defaults.adapter = originalAuthAdapter;
    axiosBase.defaults.adapter = originalApiAdapter;
  });

  it("N параллельных 401 вызывают один refresh и повторяются с новым токеном", async () => {
    const gate = deferred<AuthSession>();
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, await gate.promise)
    );
    axiosAuth.defaults.adapter = refresh;
    const requests = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.get("Authorization") === "Bearer old-token")
        throw failure(config, 401);
      return response(config, config.headers.get("Authorization"));
    });
    axiosBase.defaults.adapter = requests;

    const pending = Array.from({ length: 4 }, (_, i) =>
      axiosBase.get(`/protected/${i}`)
    );
    await vi.waitFor(() => expect(requests).toHaveBeenCalledTimes(4));
    expect(refresh).toHaveBeenCalledTimes(1);
    gate.resolve(session);
    const results = await Promise.all(pending);
    expect(results.map(({ data }) => data)).toEqual(
      Array(4).fill("Bearer new-token")
    );
    expect(requests).toHaveBeenCalledTimes(8);
    expect(refreshed).toHaveBeenCalledExactlyOnceWith(session);
    expect(expired).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "окончательный отказ refresh %s отклоняет всех и сбрасывает сессию один раз",
    async (status) => {
      const gate = deferred<void>();
      const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => {
        await gate.promise;
        throw failure(config, status);
      });
      axiosAuth.defaults.adapter = refresh;
      const requests = vi.fn(async (config: InternalAxiosRequestConfig) => {
        throw failure(config, 401);
      });
      axiosBase.defaults.adapter = requests;
      const results = Promise.allSettled(
        Array.from({ length: 4 }, () => axiosBase.get("/protected"))
      );
      await vi.waitFor(() => expect(requests).toHaveBeenCalledTimes(4));
      gate.resolve();
      expect(
        (await results).every((result) => result.status === "rejected")
      ).toBe(true);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(expired).toHaveBeenCalledTimes(1);
      expect(refreshed).not.toHaveBeenCalled();
      expect(getAccessToken()).toBeNull();
      await expect(axiosBase.get("/late-401")).rejects.toBeInstanceOf(
        AxiosError
      );
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(expired).toHaveBeenCalledTimes(1);
    }
  );

  it("403 исходного запроса не вызывает refresh", async () => {
    const refresh = vi.fn();
    axiosAuth.defaults.adapter = refresh;
    axiosBase.defaults.adapter = async (config) => {
      throw failure(config, 403);
    };
    await expect(axiosBase.get("/forbidden")).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it.each(["network", "timeout", 500, 503])(
    "временная ошибка refresh %s сохраняет сессию и допускает следующую попытку",
    async (kind) => {
      axiosAuth.defaults.adapter = async (config) => {
        throw typeof kind === "number"
          ? failure(config, kind)
          : new AxiosError(
              "Сеть",
              kind === "timeout" ? "ECONNABORTED" : "ERR_NETWORK",
              config
            );
      };
      axiosBase.defaults.adapter = async (config) => {
        if (config.headers.get("Authorization") === "Bearer old-token")
          throw failure(config, 401);
        return response(config, {});
      };
      await expect(axiosBase.get("/protected")).rejects.toBeInstanceOf(
        AxiosError
      );
      expect(getAccessToken()).toBe("old-token");
      expect(expired).not.toHaveBeenCalled();
      axiosAuth.defaults.adapter = async (config) => response(config, session);
      await expect(axiosBase.get("/protected")).resolves.toMatchObject({
        status: 200,
      });
    }
  );

  it("поздний 401 на заменённый токен повторяет запрос без нового refresh", async () => {
    const late = deferred<void>();
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, session)
    );
    axiosAuth.defaults.adapter = refresh;
    const requests = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.get("Authorization") === "Bearer old-token") {
        if (config.url === "/late") await late.promise;
        throw failure(config, 401);
      }
      return response(config, config.headers.get("Authorization"));
    });
    axiosBase.defaults.adapter = requests;
    const lateRequest = axiosBase.get("/late");
    await axiosBase.get("/first");
    late.resolve();
    expect((await lateRequest).data).toBe("Bearer new-token");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests).toHaveBeenCalledTimes(4);
  });

  it("исходный запрос повторяется не более одного раза", async () => {
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, session)
    );
    axiosAuth.defaults.adapter = refresh;
    const requests = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw failure(config, 401);
    });
    axiosBase.defaults.adapter = requests;
    await expect(axiosBase.get("/protected")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(requests).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("загрузка и таймер получают тот же промис, который ждёт интерцептор", async () => {
    const gate = deferred<AuthSession>();
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, await gate.promise)
    );
    axiosAuth.defaults.adapter = refresh;
    axiosBase.defaults.adapter = async (config) => {
      if (config.headers.get("Authorization") === "Bearer old-token")
        throw failure(config, 401);
      return response(config, {});
    };
    const load = refreshSession();
    const timer = refreshSession();
    expect(timer).toBe(load);
    const request = axiosBase.get("/protected");
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    gate.resolve(session);
    await Promise.all([load, timer, request]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshed).toHaveBeenCalledTimes(1);
  });

  it("поздний результат после logout игнорируется", async () => {
    const gate = deferred<AuthSession>();
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, await gate.promise)
    );
    axiosAuth.defaults.adapter = refresh;
    const pending = refreshSession();
    const rejected =
      expect(pending).rejects.toBeInstanceOf(SessionChangedError);
    endSession();
    expect(refresh.mock.calls[0][0].signal?.aborted).toBe(true);
    gate.resolve(session);
    await rejected;
    expect(getAccessToken()).toBeNull();
    expect(refreshed).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])(
    "старый refresh (%s) не меняет новую сессию и её промис",
    async (kind) => {
      const old = deferred<AuthSession>();
      const current = deferred<AuthSession>();
      axiosAuth.defaults.adapter = async (config) =>
        response(
          config,
          await (config.headers.get("X-Test-Session") === "new"
            ? current.promise
            : old.promise)
        );
      const pending = refreshSession();
      const rejected =
        expect(pending).rejects.toBeInstanceOf(SessionChangedError);
      beginSession();
      axiosAuth.defaults.headers.common["X-Test-Session"] = "new";
      const next = refreshSession();
      if (kind === "success") old.resolve(session);
      else
        old.reject(
          new AxiosError("Отказ", "ERR_BAD_RESPONSE", undefined, undefined, {
            status: 401,
          } as AxiosResponse)
        );
      await rejected;
      expect(refreshSession()).toBe(next);
      current.resolve({ ...session, accessToken: "next-session" });
      await next;
      expect(getAccessToken()).toBe("next-session");
      expect(expired).not.toHaveBeenCalled();
      expect(refreshed).toHaveBeenCalledTimes(1);
      delete axiosAuth.defaults.headers.common["X-Test-Session"];
    }
  );

  it("старый запрос не повторяется с токеном нового пользователя", async () => {
    const gate = deferred<void>();
    const requestStarted = deferred<void>();
    axiosBase.defaults.adapter = async (config) => {
      requestStarted.resolve();
      await gate.promise;
      throw failure(config, 401);
    };
    const pending = axiosBase.get("/protected");
    const rejected =
      expect(pending).rejects.toBeInstanceOf(SessionChangedError);
    await requestStarted.promise;
    applySession({ ...session, accessToken: "another-user" }, beginSession());
    gate.resolve();
    await rejected;
    expect(getAccessToken()).toBe("another-user");
  });
});
