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
        const { data } = await AuthClient.post<AuthSession>(
          "/sign-in",
          credentials
        );
        if (!active) throw new SessionChangedError();
        applySession(data, generation);
        onAppReady();
      } catch (error) {
        if (!active || generation !== getSessionGeneration())
          throw new SessionChangedError();
        throw error;
      }
    },
    logOut() {
      // Локальный выход не зависит от сети и срока действия refresh cookie.
      endSession();
      reset();
      void AuthClient.post("/logout").catch(() => {});
    },
    dispose() {
      active = false;
      unsubscribe();
      clearTimer();
    },
  };
}
