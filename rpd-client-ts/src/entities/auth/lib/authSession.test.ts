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
  getAccessToken,
  getSessionGeneration,
  SessionChangedError,
  type AuthSession,
} from "@shared/api";
import { UserRole } from "@shared/ability";
import { AuthClient } from "../api/clients";
import { createAuthSession } from "./authSession";
import { useAuth } from "./useAuth";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
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

const user: AuthSession = {
  accessToken: "initial-token",
  accessTokenExpiration: 20000,
  role: 3,
  fullname: { surname: "Руководов", name: "Тест", patronymic: "Тестович" },
};
const fullName = "Руководов Тест Тестович";
const roleKey = `activeRole:${fullName}`;
const storage = new Map<string, string>();
const authAdapter = axiosAuth.defaults.adapter;
const apiAdapter = axiosBase.defaults.adapter;
let lifecycles: ReturnType<typeof createAuthSession>[];

function lifecycle() {
  const onAppReady = vi.fn();
  const onUserLogged = vi.fn();
  const session = createAuthSession({ onAppReady, onUserLogged });
  lifecycles.push(session);
  return { session, onAppReady, onUserLogged };
}

describe("жизненный цикл клиентской сессии без рендеринга", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    storage.clear();
    useAuth.getState().resetAuth();
    beginSession();
    lifecycles = [];
  });

  afterEach(() => {
    lifecycles.forEach((session) => session.dispose());
    endSession();
    useAuth.getState().resetAuth();
    axiosAuth.defaults.adapter = authAdapter;
    axiosBase.defaults.adapter = apiAdapter;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("AuthClient переиспользует единственный auth HTTP-клиент", () => {
    expect(AuthClient).toBe(axiosAuth);
  });

  it("двойная загрузка StrictMode разделяет refresh; устаревшие обработчики не открывают приложение", async () => {
    const gate = deferred<AuthSession>();
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, await gate.promise)
    );
    axiosAuth.defaults.adapter = refresh;
    const first = lifecycle();
    const firstLoad = first.session.load();
    first.session.dispose();
    const second = lifecycle();
    const secondLoad = second.session.load();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(second.onAppReady).not.toHaveBeenCalled();
    gate.resolve(user);
    await Promise.all([firstLoad, secondLoad]);
    expect(first.onAppReady).not.toHaveBeenCalled();
    expect(first.onUserLogged).not.toHaveBeenCalled();
    expect(second.onAppReady).toHaveBeenCalledTimes(1);
    expect(second.onUserLogged).toHaveBeenCalledExactlyOnceWith(true);
    expect(useAuth.getState().userName).toBe(fullName);
    expect(useAuth.getState().userRole).toBe(UserRole.ROP);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("загрузка, настоящий таймер и интерцептор обновляют пользователя, роль, CASL и таймер одинаково", async () => {
    storage.set(roleKey, String(UserRole.TEACHER));
    axiosAuth.defaults.adapter = async (config) => response(config, user);
    const current = lifecycle();
    await current.session.load();
    expect(useAuth.getState().userRole).toBe(UserRole.TEACHER);
    expect(useAuth.getState().primaryRole).toBe(UserRole.ROP);
    expect(useAuth.getState().availableRoles).toEqual([
      UserRole.ROP,
      UserRole.TEACHER,
    ]);
    expect(useAuth.getState().ability.can("edit", "competencies")).toBe(true);

    const gate = deferred<AuthSession>();
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, await gate.promise)
    );
    axiosAuth.defaults.adapter = refresh;
    await vi.advanceTimersByTimeAsync(10000);
    const load = current.session.load();
    axiosBase.defaults.adapter = async (config) => {
      if (config.headers.get("Authorization") === "Bearer initial-token")
        throw failure(config, 401);
      return response(config, {});
    };
    const request = axiosBase.get("/protected");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    gate.resolve({ ...user, accessToken: "refreshed-token" });
    await Promise.all([load, request]);
    expect(getAccessToken()).toBe("refreshed-token");
    expect(current.onUserLogged).toHaveBeenCalledTimes(2);
    expect(current.onUserLogged).toHaveBeenLastCalledWith(true);
    expect(useAuth.getState().userRole).toBe(UserRole.TEACHER);
    expect(useAuth.getState().ability.can("get", "rop_interface")).toBe(false);
    expect(storage.get(roleKey)).toBe(String(UserRole.TEACHER));
    expect(vi.getTimerCount()).toBe(1);
  });

  it.each([401, 403])(
    "отказ refresh %s сбрасывает токен, таймер, имя, роли, CASL и флаг входа",
    async (status) => {
      const current = lifecycle();
      applySession(user, getSessionGeneration());
      useAuth.getState().switchRole(UserRole.TEACHER);
      current.onUserLogged.mockClear();
      axiosAuth.defaults.adapter = async (config) => {
        throw failure(config, status);
      };
      await current.session.load();
      expect(getAccessToken()).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      expect(useAuth.getState()).toMatchObject({
        userName: undefined,
        primaryRole: UserRole.ANONYMOUS,
        userRole: UserRole.ANONYMOUS,
        availableRoles: [UserRole.ANONYMOUS],
      });
      expect(useAuth.getState().ability.can("get", "auth")).toBe(true);
      expect(useAuth.getState().ability.can("get", "lk")).toBe(false);
      expect(current.onUserLogged).toHaveBeenCalledExactlyOnceWith(false);
      expect(current.onAppReady).toHaveBeenCalledTimes(1);
      expect(storage.has(roleKey)).toBe(false);
    }
  );

  it("временная ошибка загрузки завершает ожидание и сохраняет активную роль для следующего входа", async () => {
    storage.set(roleKey, String(UserRole.TEACHER));
    const current = lifecycle();
    axiosAuth.defaults.adapter = async (config) => {
      throw failure(config, 503);
    };
    await current.session.load();
    expect(current.onAppReady).toHaveBeenCalledTimes(1);
    expect(current.onUserLogged).not.toHaveBeenCalled();
    expect(storage.get(roleKey)).toBe(String(UserRole.TEACHER));
    axiosAuth.defaults.adapter = async (config) => response(config, user);
    await current.session.signIn({ userName: "rop", password: "test" });
    expect(useAuth.getState().userRole).toBe(UserRole.TEACHER);
    expect(current.onUserLogged).toHaveBeenCalledExactlyOnceWith(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("временная ошибка таймера сохраняет сессию и планирует повтор", async () => {
    const current = lifecycle();
    applySession(user, getSessionGeneration());
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw failure(config, 503);
    });
    axiosAuth.defaults.adapter = refresh;
    await vi.advanceTimersByTimeAsync(10000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("initial-token");
    expect(current.onUserLogged).toHaveBeenCalledExactlyOnceWith(true);
    expect(useAuth.getState().userRole).toBe(UserRole.ROP);
    expect(vi.getTimerCount()).toBe(1);
    axiosAuth.defaults.adapter = async (config) =>
      response(config, { ...user, accessToken: "retry-token" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(getAccessToken()).toBe("retry-token");
    expect(current.onUserLogged).toHaveBeenLastCalledWith(true);
  });

  it.each([401, 500, "network"])(
    "logout сбрасывает локальную сессию даже при ошибке сервера %s",
    async (status) => {
      const current = lifecycle();
      applySession(user, getSessionGeneration());
      useAuth.getState().switchRole(UserRole.TEACHER);
      const logout = vi.fn(async (config: InternalAxiosRequestConfig) => {
        throw typeof status === "number"
          ? failure(config, status)
          : new AxiosError("Сеть", "ERR_NETWORK", config);
      });
      axiosAuth.defaults.adapter = logout;
      current.session.logOut();
      expect(getAccessToken()).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      expect(useAuth.getState()).toMatchObject({
        userName: undefined,
        primaryRole: UserRole.ANONYMOUS,
        userRole: UserRole.ANONYMOUS,
        availableRoles: [UserRole.ANONYMOUS],
      });
      expect(useAuth.getState().ability.can("get", "lk")).toBe(false);
      expect(current.onUserLogged).toHaveBeenLastCalledWith(false);
      expect(storage.has(roleKey)).toBe(false);
      await vi.advanceTimersByTimeAsync(20000);
      expect(logout).toHaveBeenCalledTimes(1);
      expect(logout.mock.calls[0][0].url).toBe("/logout");
    }
  );

  it("поздний вход после logout не восстанавливает сессию", async () => {
    const gate = deferred<AuthSession>();
    const current = lifecycle();
    axiosAuth.defaults.adapter = async (config) =>
      response(config, config.url === "/sign-in" ? await gate.promise : {});
    const pending = current.session.signIn({
      userName: "rop",
      password: "test",
    });
    const rejected =
      expect(pending).rejects.toBeInstanceOf(SessionChangedError);
    current.session.logOut();
    gate.resolve(user);
    await rejected;
    expect(getAccessToken()).toBeNull();
    expect(useAuth.getState().userRole).toBe(UserRole.ANONYMOUS);
    expect(current.onUserLogged).toHaveBeenCalledExactlyOnceWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
