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
    background: { default: "#f4f6f8", paper: "#ffffff" },
  },
  typography: {
    fontFamily: "Arial, system-ui, sans-serif",
    fontSize: 14,
    body1: { fontSize: 14, lineHeight: "20px" },
    body2: { fontSize: 14, lineHeight: "20px" },
    caption: { fontSize: 12, lineHeight: "16px" },
    h1: { fontSize: 24, lineHeight: "32px", fontWeight: 600 },
    h2: { fontSize: 20, lineHeight: "28px", fontWeight: 600 },
    h3: { fontSize: 16, lineHeight: "24px", fontWeight: 600 },
    button: {
      fontSize: 14,
      lineHeight: "20px",
      fontWeight: 400,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        ":focus-visible": {
          outline: `2px solid ${theme.palette.info.main}`,
          outlineOffset: 2,
        },
        "button, input, textarea, select": { font: "inherit" },
      }),
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: {
        size: "small",
        disableElevation: true,
      },
      styleOverrides: {
        root: { minHeight: 36, paddingInline: 12, boxShadow: "none" },
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: { root: { width: 36, height: 36 } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none", boxShadow: "none" } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          minWidth: 0,
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          ...theme.typography.h2,
          padding: theme.spacing(2, 3),
          [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
        }),
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1.5, 3),
          gap: theme.spacing(1),
          flexShrink: 0,
          [theme.breakpoints.down("sm")]: { padding: theme.spacing(1.5, 2) },
        }),
      },
    },
    MuiTableCell: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: ({ theme }) => ({
          ...theme.typography.body2,
          padding: "6px 10px",
          overflowWrap: "anywhere",
        }),
        head: ({ theme }) => ({
          fontWeight: 600,
          backgroundColor: theme.palette.background.default,
        }),
      },
    },
    MuiLink: {
      defaultProps: { underline: "always" },
      styleOverrides: { root: ({ theme }) => ({ ...theme.typography.body2 }) },
    },
    MuiTabs: { styleOverrides: { root: { minHeight: 36 } } },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          ...theme.typography.button,
          minHeight: 36,
          padding: theme.spacing(1, 1.5),
        }),
      },
    },
    MuiMenu: {
      defaultProps: {
        slotProps: {
          paper: { elevation: 0, sx: { border: 1, borderColor: "divider" } },
        },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 36 } } },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          padding: theme.spacing(0.5, 1.5),
        }),
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
          paddingTop: 6,
          paddingBottom: 6,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: ({ theme }) => ({ ...theme.typography.body2 }),
        input: ({ theme }) => ({ ...theme.typography.body2 }),
      },
    },
    MuiDialogContent: {
      // Линии под заголовком и над кнопками у всех диалогов: прокручивается только содержимое.
      defaultProps: {
        dividers: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 0,
          overscrollBehavior: "contain",
          padding: theme.spacing(2.5, 3),
          [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
        }),
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        // В MUI 9 отступ иконки до текста уменьшился с 56 до 36 px — возвращаем прежний.
        // Внутри MenuItem ширину по-прежнему задаёт MUI (селектор специфичнее).
        root: ({ theme }) => ({
          minWidth: theme.spacing(7),
        }),
      },
    },
    MuiFormControl: {
      styleOverrides: {
        // Метка — в ячейке сетки поля ввода, а не во всём FormControl: иначе helperText
        // увеличивает высоту контейнера и «top: 50%» уводит метку вниз.
        root: {
          "&:has(> .MuiInputLabel-outlined)": {
            display: "inline-grid",
            alignContent: "start",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.MuiInputLabel-outlined": {
            gridArea: "1 / 1 / 2 / 2",
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
