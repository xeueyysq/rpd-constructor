import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  typography: {
    fontFamily: "Inter",
    h2: {
      fontFamily: "Inter",
      fontSize: "1.5em",
      fontWeight: 700,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        #root {
          transform: scale(1.1);
          transform-origin: top left;
          width: 91% !important;
          overflow: hidden;
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          src: url('/src/shared/fonts/Inter-Regular.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 500;
          src: url('/src/shared/fonts/Inter-Medium.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          src: url('/src/shared/fonts/Inter-SemiBold.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 700;
          src: url('/src/shared/fonts/Inter-Bold.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Arial MT';
          font-style: normal;
          font-weight: 400;
          src: url('/src/shared/fonts/arialmt.ttf') format('truetype');
        }
        h2 {
          font-family: 'Inter' !important;
        }
      `,
    },
    MuiTypography: {
      styleOverrides: {
        h2: {
          fontFamily: "Inter !important",
        },
      },
    },
  },
});
