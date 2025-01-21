import {FC, ReactNode} from "react"
import CaslProvider from "./CaslProvider"
import AuthProvider from "./AuthProvider"
import {SnackbarProvider} from 'notistack'

type Props = {
    children: ReactNode;
};

export const AppProviders: FC<Props> = ({children}) => {
    return (
        <AuthProvider>
            <CaslProvider>
                <SnackbarProvider maxSnack={3}>
                    {children}
                </SnackbarProvider>
            </CaslProvider>
        </AuthProvider>
    )
}
