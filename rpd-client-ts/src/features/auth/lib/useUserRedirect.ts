import {useContext, useMemo} from 'react';
import {AuthContext} from "../model/authContext.ts";
import {useAuth} from "./useAuth.ts";

type TUseUserRedirectResult = {
    redirectPath: "/sign-in" | "/manager" | "/teacher-interface" | "/rpd-template";
    isUserLogged: boolean | undefined;
}

export const useUserRedirect = (): TUseUserRedirectResult => {
    const {isUserLogged} = useContext(AuthContext);
    const userRole = useAuth.getState().userRole;

    const redirectPath = useMemo(() => {
        if (!isUserLogged) return "/sign-in";
        if (userRole === "rop") return "/manager";
        if (userRole === "teacher") return "/teacher-interface";
        if (userRole === "admin") return "/rpd-template";

        return "/sign-in";
    }, [isUserLogged, userRole]);

    return {isUserLogged, redirectPath};
};
