import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth.ts";
import { AuthClient } from "../api/clients.ts";
import { AuthContextProps, UserCredentials } from "../model/types.ts";
import { showErrorMessage } from "@shared/lib";

export const useAuthContextValue = (): AuthContextProps => {
  const [isAppReady, setIsAppReady] = useState(false);
  const [isUserLogged, setIsUserLogged] = useState(false);
  const [data, setData] = useState<UserCredentials>();
  const { updateAbility, updateUserName } = useAuth();

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (expiration: number) => {
      clearRefreshTimer();
      const refreshTime = expiration - 10000;

      refreshTimeoutRef.current = setTimeout(() => {
        AuthClient.post("/refresh")
          .then((res) => {
            const { role, fullname, accessTokenExpiration } = res.data;
            updateAbility(role);
            updateUserName(fullname);
            setIsUserLogged(true);
            scheduleRefresh(accessTokenExpiration);
          })
          .catch(() => {
            setIsUserLogged(false);
          });
      }, refreshTime);
    },
    [clearRefreshTimer, updateAbility, updateUserName]
  );

  const handleLogOut = useCallback(() => {
    AuthClient.post("/logout")
      .then(() => {
        setIsUserLogged(false);
        updateAbility();
        updateUserName(undefined);
        setData(undefined);
        clearRefreshTimer();
      })
      .catch((error) => showErrorMessage(error.response.data.error));
  }, [updateAbility, updateUserName, clearRefreshTimer]);

  const handleSignIn = useCallback(
    (credentials: UserCredentials) => {
      AuthClient.post("/sign-in", credentials)
        .then((res) => {
          const { fullname, role, accessTokenExpiration } = res.data;
          updateAbility(role);
          updateUserName(fullname);
          setIsUserLogged(true);
          scheduleRefresh(accessTokenExpiration);
        })
        .catch((error) => showErrorMessage(error.response.data.error));
    },
    [updateAbility, updateUserName, scheduleRefresh]
  );

  const refreshToken = useCallback(() => {
    AuthClient.post("/refresh")
      .then((res) => {
        const { role, fullname, accessTokenExpiration } = res.data;
        updateAbility(role);
        updateUserName(fullname);
        setIsUserLogged(true);
        setIsAppReady(true);
        scheduleRefresh(accessTokenExpiration);
      })
      .catch(() => {
        setIsAppReady(true);
        setIsUserLogged(false);
      });
  }, [scheduleRefresh, updateAbility, updateUserName]);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  return {
    isAppReady,
    isUserLogged,
    data,
    handleLogOut,
    handleSignIn,
  };
};
