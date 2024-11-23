import {FC, ReactNode} from "react";
import {CaslProvider} from "./CaslProvider";
import {AuthProvider} from "../../context/AuthContext.tsx";

type Props = {
    children: ReactNode;
};

export const AppProviders: FC<Props> = ({children}) => {
    return (
        <AuthProvider>
            <CaslProvider>
                {children}
            </CaslProvider>
        </AuthProvider>
    );
};
