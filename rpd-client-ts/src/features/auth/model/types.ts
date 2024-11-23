export type dataProps = {
    userName: string
    password: string
}

export type AuthContextProps = {
    isAppReady?: boolean;
    isUserLogged?: boolean;
    data?: dataProps | undefined;
    handleFetchProtected?: () => void;
    handleLogOut?: () => void;
    handleSignUp?: (data: dataProps) => void;
    handleSignIn: (data: dataProps) => void;
}
