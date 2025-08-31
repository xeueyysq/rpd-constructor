import { FC, ReactNode } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CaslProvider from "./CaslProvider";
import AuthProvider from "./AuthProvider";
import { SnackbarProvider } from "notistack";
import { themeOptions } from "../../shared/config";
import { CssBaseline } from "@mui/material";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const theme = createTheme(themeOptions);
const queryClient = new QueryClient();

type Props = {
  children: ReactNode;
};

export const AppProviders: FC<Props> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <CaslProvider>
            <SnackbarProvider maxSnack={3}>{children}</SnackbarProvider>
          </CaslProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
