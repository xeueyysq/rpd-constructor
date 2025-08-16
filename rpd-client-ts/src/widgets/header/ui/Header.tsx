import { FC, useContext, useMemo } from "react";
import { Box, AppBar, Toolbar } from "@mui/material";
import { useWindowSize } from "@shared/hooks";
import HeaderMenuMobile from "./HeaderMenuMobile.tsx";
import HeaderLogo from "./HeaderLogo.tsx";
import { AuthContext, useAuth } from "@entities/auth";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { UserRole } from "@shared/ability";

export const Header: FC = () => {
  const size = useWindowSize();
  const { isUserLogged } = useContext(AuthContext);
  const userName = useAuth.getState().userName;
  const userRole = useAuth.getState().userRole;

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
        <Box
          width={"100%"}
          display={"flex"}
          justifyContent={"space-between"}
          alignItems={"center"}
        >
          <HeaderLogo />
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
                <AccountCircleIcon sx={{ fontSize: "50px" }} />
              </Box>
            </Box>
          )}
          {/* {size.width && size.width < 1090 && <HeaderMenuMobile />} */}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
