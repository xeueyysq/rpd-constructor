import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { AuthContextProps, UserCredentials } from "../model/types.ts";
import { showErrorMessage } from "@shared/lib";
import { SessionChangedError } from "@shared/api";
import { createAuthSession } from "./authSession";

export const useAuthContextValue = (): AuthContextProps => {
  const [isAppReady, setIsAppReady] = useState(false);
  const [isUserLogged, setIsUserLogged] = useState(false);
  const sessionRef = useRef<ReturnType<typeof createAuthSession> | null>(null);

  useEffect(() => {
    const session = createAuthSession({
      onAppReady: () => setIsAppReady(true),
      onUserLogged: setIsUserLogged,
    });
    sessionRef.current = session;
    void session.load();
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  const handleLogOut = useCallback(() => sessionRef.current?.logOut(), []);
  const handleSignIn = useCallback(async (credentials: UserCredentials) => {
    try {
      await sessionRef.current?.signIn(credentials);
    } catch (error) {
      if (error instanceof SessionChangedError) return;
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      showErrorMessage(message ?? "Не удалось войти. Попробуйте ещё раз.");
    }
  }, []);

  return { isAppReady, isUserLogged, handleLogOut, handleSignIn };
};
