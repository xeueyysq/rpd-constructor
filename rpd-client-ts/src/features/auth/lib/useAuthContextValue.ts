import {useEffect, useState} from "react";
import {useAuth} from "./useAuth";
import showErrorMessage from "@shared/lib/showErrorMessage.ts";
import inMemoryJWT from "./inMemoryJWT.ts";
import config from "@shared/config";
import {AuthClient, ResourceClient} from "../api/clients.ts";
import {AuthContextProps, dataProps} from "../model/types.ts";

export const useAuthContextValue = (): AuthContextProps => {
    const [isAppReady, setIsAppReady] = useState<boolean>(false);
    const [isUserLogged, setIsUserLogged] = useState<boolean>(false);
    const [data, setData] = useState<dataProps>();
    const {updateAbility, updateUserName} = useAuth();

    const handleFetchProtected = () => {
        ResourceClient.get("/protected")
            .then((res) => {
                setData(res.data);
            })
            .catch((error) => showErrorMessage(error.response.data.error));
    };

    const handleLogOut = () => {
        AuthClient.post("/logout")
            .then(() => {
                setIsUserLogged(false);
                inMemoryJWT.deleteToken();
                updateAbility();
                updateUserName(undefined);
                setData(undefined);
            })
            .catch((error) => showErrorMessage(error.response.data.error));
    };

    const handleSignUp = (data: dataProps) => {
        AuthClient.post("/sign-up", data)
            .then((res) => {
                const {accessToken, accessTokenExpiration} = res.data;

                inMemoryJWT.setToken(accessToken, accessTokenExpiration);
                setIsUserLogged(true);
            })
            .catch((error) => showErrorMessage(error.response.data.error));
    };

    const handleSignIn = (data: dataProps) => {
        AuthClient.post("/sign-in", data)
            .then((res) => {
                const {fullname, role, accessToken, accessTokenExpiration} = res.data;

                inMemoryJWT.setToken(accessToken, accessTokenExpiration);
                updateAbility(role);
                updateUserName(fullname);
                setIsUserLogged(true);
            })
            .catch((error) => showErrorMessage(error.response.data.error));
    };

    useEffect(() => {
        AuthClient.post("/refresh")
            .then((res) => {
                const {role, fullname, accessToken, accessTokenExpiration} = res.data;
                inMemoryJWT.setToken(accessToken, accessTokenExpiration);
                updateAbility(role);
                updateUserName(fullname);

                setIsAppReady(true);
                setIsUserLogged(true);
            })
            .catch(() => {
                setIsAppReady(true);
                setIsUserLogged(false);
            });
    }, [updateAbility, updateUserName]);

    useEffect(() => {
        const handlePersistedLogOut = (event: StorageEvent) => {
            if (event.key === config.LOGOUT_STORAGE_KEY) {
                inMemoryJWT.deleteToken();
                setIsUserLogged(false);
            }
        };

        window.addEventListener("storage", handlePersistedLogOut);

        return () => {
            window.removeEventListener("storage", handlePersistedLogOut);
        };
    }, []);

    return {
        isAppReady,
        isUserLogged,
        data,
        handleFetchProtected,
        handleLogOut,
        handleSignUp,
        handleSignIn
    }
}