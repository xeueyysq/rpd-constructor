import { FC, ReactNode } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CaslProvider from "./CaslProvider";
import AuthProvider from "./AuthProvider";
import { SnackbarProvider } from "notistack";
import { themeOptions } from "../../shared/config";
import { CssBaseline } from "@mui/material";

const theme = createTheme(themeOptions);

type Props = {
  children: ReactNode;
};

export const AppProviders: FC<Props> = ({ children }) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <CaslProvider>
          <SnackbarProvider maxSnack={3}>{children}</SnackbarProvider>
        </CaslProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
