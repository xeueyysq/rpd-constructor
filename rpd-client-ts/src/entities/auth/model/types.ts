export type UserCredentials = {
  userName: string;
  password: string;
};

export type AuthContextProps = {
  isAppReady: boolean;
  isUserLogged: boolean;
  data?: UserCredentials;
  handleLogOut: () => void;
  handleSignIn: (data: UserCredentials) => void;
};
