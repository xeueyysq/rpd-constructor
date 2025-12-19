import { FC, useContext } from "react";
import { Box, AppBar, Toolbar, IconButton } from "@mui/material";
import { AccountSettings } from "./AccountSettings.tsx";
import HeaderLogo from "./HeaderLogo.tsx";
import { AuthContext } from "@entities/auth";
import { useStore } from "@shared/hooks";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material";

export const Header: FC = () => {
  const { isUserLogged } = useContext(AuthContext);
  const { toggleDrawer } = useStore();
  const theme = useTheme();

  return (
    <AppBar
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.primary.main,
      }}
    >
      <Toolbar>
        <Box width={"100%"} display={"flex"} justifyContent={"space-between"} alignItems={"center"}>
          <Box display={"flex"} alignItems={"center"}>
            <IconButton color="inherit" aria-label="toggle drawer" onClick={toggleDrawer} edge="start" sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
            <HeaderLogo />
          </Box>
          {isUserLogged && <AccountSettings />}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
