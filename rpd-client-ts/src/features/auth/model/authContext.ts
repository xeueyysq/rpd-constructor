import {createContext} from "react";

interface dataProps {
    userName: string;
    password: string;
}

interface AuthContextProps {
    data?: dataProps | undefined;
    handleFetchProtected?: () => void;
    handleSignUp?: (data: dataProps) => void;
    handleSignIn: (data: dataProps) => void;
    handleLogOut?: () => void;
    isAppReady?: boolean;
    isUserLogged?: boolean;
}

export const AuthContext = createContext<AuthContextProps>({
    handleSignIn: () => {
    }
});