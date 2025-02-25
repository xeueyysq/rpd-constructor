import { FC, ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CaslProvider from "./CaslProvider";
import AuthProvider from "./AuthProvider";
import { SnackbarProvider } from "notistack";
import { theme } from "@shared/ui/theme";
import { CssBaseline } from "@mui/material";

type Props = {
  children: ReactNode;
};

export const AppProviders: FC<Props> = ({ children }) => {
  return (
    <AuthProvider>
      <CaslProvider>
        <SnackbarProvider maxSnack={3}>{children}</SnackbarProvider>
      </CaslProvider>
    </AuthProvider>
  );
};
