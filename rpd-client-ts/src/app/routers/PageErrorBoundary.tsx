import { captureRuntimeError, markHandledError } from "@shared/diagnostics";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

function PageErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 6 }}>
      <Alert severity="error">
        <Typography variant="h6" component="h1" sx={{ mb: 1 }}>
          Не удалось показать страницу
        </Typography>
        <Typography>Попробуйте ещё раз или перезагрузите страницу.</Typography>
      </Alert>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ mt: 2, flexWrap: "wrap" }}
      >
        <Button variant="contained" onClick={onRetry}>
          Повторить
        </Button>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Перезагрузить страницу
        </Button>
      </Stack>
    </Box>
  );
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    captureRuntimeError(error, "runtime.page");
    markHandledError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <PageErrorFallback onRetry={() => this.setState({ failed: false })} />
    );
  }
}
