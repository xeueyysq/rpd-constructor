import { useMemo, type ReactNode } from "react";
import { createTheme, ThemeProvider, useTheme } from "@mui/material/styles";

// Только новые диалоги: контекст темы сохраняется и в их порталах.
// CssBaseline здесь не используем — его глобальные правила затронули бы редактор.
export function CompactDialogTheme({ children }: { children: ReactNode }) {
  const parent = useTheme();
  const theme = useMemo(
    () =>
      createTheme(
        {
          ...parent,
          typography: {
            fontFamily: "Arial, system-ui, sans-serif",
            fontSize: 14,
            body1: { fontSize: 14, lineHeight: "20px" },
            body2: { fontSize: 14, lineHeight: "20px" },
            caption: { fontSize: 12, lineHeight: "16px" },
            h2: { fontSize: 20, lineHeight: "28px", fontWeight: 600 },
            button: {
              fontSize: 14,
              lineHeight: "20px",
              fontWeight: 400,
              textTransform: "none",
            },
          },
        },
        {
          components: {
            MuiButtonBase: { defaultProps: { disableRipple: true } },
            MuiButton: {
              defaultProps: { disableElevation: true },
              styleOverrides: {
                root: { boxShadow: "none" },
              },
            },
            MuiDialog: {
              styleOverrides: {
                paper: {
                  minWidth: 0,
                  border: `1px solid ${parent.palette.divider}`,
                  boxShadow: "none",
                  "& :focus-visible": {
                    outline: `2px solid ${parent.palette.info.main}`,
                    outlineOffset: 2,
                  },
                },
              },
            },
            MuiDialogTitle: {
              styleOverrides: {
                root: {
                  fontSize: 20,
                  lineHeight: "28px",
                  fontWeight: 600,
                  padding: parent.spacing(2, 3),
                  [parent.breakpoints.down("sm")]: {
                    padding: parent.spacing(2),
                  },
                },
              },
            },
            MuiDialogActions: {
              styleOverrides: {
                root: {
                  padding: parent.spacing(1.5, 3),
                  gap: parent.spacing(1),
                  flexShrink: 0,
                  [parent.breakpoints.down("sm")]: {
                    padding: parent.spacing(1.5, 2),
                  },
                },
              },
            },
            MuiDialogContent: {
              styleOverrides: {
                root: {
                  minHeight: 0,
                  overscrollBehavior: "contain",
                  padding: parent.spacing(2.5, 3),
                  [parent.breakpoints.down("sm")]: {
                    padding: parent.spacing(2),
                  },
                },
              },
            },
            MuiTableCell: {
              defaultProps: { size: "small" },
              styleOverrides: {
                root: {
                  fontSize: 14,
                  lineHeight: "20px",
                  padding: "6px 10px",
                  overflowWrap: "anywhere",
                },
                head: { fontWeight: 600 },
              },
            },
            MuiTab: {
              styleOverrides: {
                root: {
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 400,
                  minHeight: 36,
                  padding: parent.spacing(1, 1.5),
                },
              },
            },
            MuiInputBase: {
              styleOverrides: {
                root: { fontSize: 14, lineHeight: "20px" },
                input: { fontSize: 14, lineHeight: "20px" },
              },
            },
            MuiAlert: {
              styleOverrides: {
                root: {
                  border: `1px solid ${parent.palette.divider}`,
                  padding: parent.spacing(0.5, 1.5),
                },
              },
            },
          },
        }
      ),
    [parent]
  );
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
