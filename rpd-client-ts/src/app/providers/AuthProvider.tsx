import { FC, ReactNode } from "react";
import { AuthContext, useAuthContextValue } from "@entities/auth";
import { Loader } from "@shared/ui";

const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { data, handleSignIn, handleLogOut, isAppReady, isUserLogged } =
    useAuthContextValue();

  return (
    <AuthContext.Provider
      value={{
        data,
        handleSignIn,
        handleLogOut,
        isAppReady,
        isUserLogged,
      }}
    >
      {isAppReady ? children : <Loader />}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
