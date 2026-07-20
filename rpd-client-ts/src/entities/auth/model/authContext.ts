import { createContext } from "react";
import { AuthContextProps } from "./types.ts";

export const AuthContext = createContext<AuthContextProps>({
  isAppReady: false,
  isUserLogged: false,
  handleSignIn: () => {},
  handleLogOut: () => {},
});
