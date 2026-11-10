import {
  applySession,
  beginSession,
  endSession,
  getSessionGeneration,
  refreshSession,
  SessionChangedError,
  subscribeToSession,
  type AuthSession,
} from "@shared/api";
import { AuthClient } from "../api/clients";
import { useAuth } from "./useAuth";
import type { UserCredentials } from "../model/types";

type SessionCallbacks = {
  onAppReady: () => void;
  onUserLogged: (logged: boolean) => void;
};

let pendingLogout: Promise<unknown> = Promise.resolve();
const returnPolicyKey = "authReturnPolicy:v1";

function readReturnPolicy(): { version: number; remember: boolean } {
  try {
    const policy: unknown = JSON.parse(
      sessionStorage.getItem(returnPolicyKey) ?? "null"
    );
    if (
      policy &&
      typeof policy === "object" &&
      "version" in policy &&
      typeof policy.version === "number" &&
      Number.isSafeInteger(policy.version) &&
      policy.version >= 0 &&
      "remember" in policy &&
      typeof policy.remember === "boolean"
    )
      return { version: policy.version, remember: policy.remember };
  } catch {
    /* sessionStorage может быть недоступен. */
  }
  return { version: 0, remember: true };
}

let returnPolicy = readReturnPolicy();

function setReturnPolicy(policy: typeof returnPolicy) {
  returnPolicy = policy;
  try {
    sessionStorage.setItem(returnPolicyKey, JSON.stringify(policy));
  } catch {
    /* В текущем SPA политика сохраняется и без sessionStorage. */
  }
}

export const getAuthReturnPolicy = () => returnPolicy;

// Жизненный цикл без React: одна подписка применяет любой результат refresh.
export function createAuthSession({
  onAppReady,
  onUserLogged,
}: SessionCallbacks) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { updateAbility, updateUserName, resetAuth } = useAuth.getState();

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function scheduleRefresh(expiration: number) {
    clearTimer();
    const generation = getSessionGeneration();
    timer = setTimeout(
      () => {
        if (!active || generation !== getSessionGeneration()) return;
        void refreshSession().catch(() => {
          // При временной ошибке сохраняем сессию и повторяем через 10 секунд.
          if (active && generation === getSessionGeneration())
            scheduleRefresh(20000);
        });
      },
      Math.max(expiration - 10000, 1000)
    );
  }

  function reset() {
    clearTimer();
    resetAuth();
    onUserLogged(false);
    onAppReady();
  }

  const unsubscribe = subscribeToSession({
    onRefreshed: ({ fullname, role, accessTokenExpiration }) => {
      updateUserName(fullname);
      updateAbility(role);
      onUserLogged(true);
      scheduleRefresh(accessTokenExpiration);
    },
    onExpired: reset,
  });

  return {
    async load() {
      const generation = getSessionGeneration();
      try {
        await refreshSession();
      } catch {
        // При временной ошибке показываем вход, сохраняя роль в sessionStorage.
        // ProtectedRoute сохраняет исходный адрес для следующего входа.
      } finally {
        if (active && generation === getSessionGeneration()) onAppReady();
      }
    },
    async signIn(credentials: UserCredentials) {
      const generation = beginSession();
      clearTimer();
      try {
        // Ответ logout удаляет cookie: он должен прийти раньше нового sign-in.
        await pendingLogout;
        if (!active || generation !== getSessionGeneration())
          throw new SessionChangedError();
        const { data } = await AuthClient.post<AuthSession>(
          "/sign-in",
          credentials
        );
        if (!active) throw new SessionChangedError();
        applySession(data, generation);
        setReturnPolicy({ ...returnPolicy, remember: true });
        onAppReady();
      } catch (error) {
        if (!active || generation !== getSessionGeneration())
          throw new SessionChangedError();
        throw error;
      }
    },
    logOut() {
      // Локальный выход не зависит от сети и срока действия refresh cookie.
      setReturnPolicy({ version: returnPolicy.version + 1, remember: false });
      endSession();
      reset();
      pendingLogout = pendingLogout
        .then(() => AuthClient.post("/logout"))
        .catch(() => {});
    },
    dispose() {
      active = false;
      unsubscribe();
      clearTimer();
    },
  };
}
