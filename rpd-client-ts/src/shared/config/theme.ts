import { ThemeOptions } from "@mui/material/styles";

export const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    primary: {
      main: "#19284b",
      light: "#546E7A",
      dark: "#1F2C39",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#5D6D7E",
      light: "#8898A8",
      dark: "#34495E",
      contrastText: "#ffffff",
    },
    error: {
      main: "#D32F2F",
    },
    warning: {
      main: "#ED6C02",
    },
    info: {
      main: "#0288D1",
    },
    success: {
      main: "#2E7D32",
    },
    text: {
      primary: "#263238",
      secondary: "#546E7A",
    },
    divider: "rgba(0, 0, 0, 0.12)",
  },
  typography: {
    button: { textTransform: "none" },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      defaultProps: {
        size: "small",
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: "small",
      },
    },
    MuiButtonGroup: {
      defaultProps: {
        size: "small",
      },
    },
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        select: {
          paddingTop: 4,
          paddingBottom: 4,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.MuiInputLabel-outlined": {
            top: "50%",
            transform: "translate(14px, -50%)",
          },
          "&.MuiInputLabel-outlined.MuiInputLabel-shrink": {
            top: 0,
            transform: "translate(14px, -9px) scale(0.75)",
          },
        },
      },
    },
  },
};
