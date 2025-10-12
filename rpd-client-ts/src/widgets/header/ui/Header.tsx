import { FC, useContext, useMemo } from "react";
import { Box, AppBar, Toolbar, IconButton } from "@mui/material";
import AccountMenuButton from "./AccountMenuButton.tsx";
import HeaderLogo from "./HeaderLogo.tsx";
import { AuthContext, useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import MenuIcon from "@mui/icons-material/Menu";

export const Header: FC = () => {
  const { isUserLogged } = useContext(AuthContext);
  const userName = useAuth.getState().userName;
  const userRole = useAuth.getState().userRole;
  const { toggleDrawer } = useStore();

  const userRoleLocale = useMemo(() => {
    switch (userRole) {
      case UserRole.ADMIN:
        return "Администратор";
      case UserRole.TEACHER:
        return "Преподаватель";
      case UserRole.ROP:
        return "Руководитель образовательной программы";
      default:
        return "Неавторизованный пользователь";
    }
  }, [userRole]);

  return (
    <AppBar
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: "#29363d",
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
          {isUserLogged && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box>
                <Box>{userName}</Box>
                <Box
                  sx={{
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "#B2B2B2",
                    textAlign: "right",
                  }}
                >
                  {userRoleLocale}
                </Box>
              </Box>
              <Box sx={{ px: 1 }}>
                <AccountMenuButton />
              </Box>
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
