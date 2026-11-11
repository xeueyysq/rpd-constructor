import { FC, Fragment, ReactNode, useSyncExternalStore } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CaslProvider from "./CaslProvider";
import AuthProvider from "./AuthProvider";
import { SnackbarProvider } from "notistack";
import { themeOptions } from "../../shared/config";
import { CssBaseline } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  getSessionGeneration,
  subscribeToSessionGeneration,
} from "@shared/api";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { getSessionQueryClient } from "./sessionState";
import { DiagnosticsSessionBridge } from "./DiagnosticsBridge";

const theme = createTheme(themeOptions);

type Props = {
  children: ReactNode;
};

function SessionContent({ children }: Props) {
  const generation = useSyncExternalStore(
    subscribeToSessionGeneration,
    getSessionGeneration
  );
  const loggedIn = useAuth((state) => state.userRole !== UserRole.ANONYMOUS);
  return (
    <QueryClientProvider client={getSessionQueryClient()}>
      <Fragment key={loggedIn ? generation : "anonymous"}>
        {loggedIn ? <DiagnosticsSessionBridge /> : null}
        {children}
      </Fragment>
    </QueryClientProvider>
  );
}

export const AppProviders: FC<Props> = ({ children }) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <SessionContent>
          <CaslProvider>
            <SnackbarProvider
              maxSnack={3}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
            >
              {children}
            </SnackbarProvider>
          </CaslProvider>
        </SessionContent>
      </AuthProvider>
    </ThemeProvider>
  );
};
