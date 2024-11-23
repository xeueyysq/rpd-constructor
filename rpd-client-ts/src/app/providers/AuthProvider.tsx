import {FC, ReactNode} from "react";
import Loader from "@shared/ui/Loader.tsx";
import {AuthContext, useAuthContextValue} from "@features/auth";

const AuthProvider: FC<{ children: ReactNode }> = ({children}) => {
    const {
        data,
        handleFetchProtected,
        handleSignUp,
        handleSignIn,
        handleLogOut,
        isAppReady,
        isUserLogged
    } = useAuthContextValue()


    return (
        <AuthContext.Provider
            value={{
                data,
                handleFetchProtected,
                handleSignUp,
                handleSignIn,
                handleLogOut,
                isAppReady,
                isUserLogged,
            }}
        >
            {isAppReady ? (
                children
            ) : (
                <>
                    <Loader/>
                </>
            )}
        </AuthContext.Provider>
    );
};

export default AuthProvider;