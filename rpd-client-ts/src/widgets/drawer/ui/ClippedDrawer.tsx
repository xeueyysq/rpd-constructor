import { useAuth } from "@entities/auth";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";
import { TeacherRpdListItems } from "@pages/teacher-interface/model/teacherInterfaceItems";
import { UserRole } from "@shared/ability";
import { RedirectPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import { Header } from "@widgets/header";
import { RpdList } from "@widgets/rpd-list";
import { MainTabsList, TeacherTabsList } from "@widgets/tabs-list";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

export function ClippedDrawer() {
  const userRole = useAuth((state) => state.userRole);
  const location = useLocation();
  const path = location.pathname;
  const TEMPLATE_DRAWER_WIDTH = 320;
  const [drawerWidth, setDrawerWidth] = useState<number>(240);
  const { isDrawerOpen } = useStore();

  //@TODO Костыль на определение страницы
  const isTemplatePage = useMemo(
    () =>
      path.includes(RedirectPath.TEMPLATES) && path.split("/").filter((part) => part && !isNaN(Number(part))).length,
    [path]
  );

  const page = useMemo(() => {
    if (isTemplatePage) return "template";
    switch (userRole) {
      case UserRole.ROP:
      case UserRole.ADMIN:
        return "main";
      case UserRole.TEACHER:
        return "teacher";
      default:
        break;
    }
  }, [userRole, isTemplatePage]);

  const switchMap = {
    main: <MainTabsList />,
    teacher: <TeacherTabsList />,
    template: <RpdList RpdListItems={TeacherRpdListItems} />,
  };

  useEffect(() => {
    if (isTemplatePage) setDrawerWidth(TEMPLATE_DRAWER_WIDTH);
    else setDrawerWidth(240);
  }, [isTemplatePage]);

  if (path === RedirectPath.SIGN_IN) return <Outlet />;

  return (
    <Box sx={{ position: "relative", minHeight: "100vh" }}>
      <Header />
      <Drawer
        color="default"
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          position: "fixed",
          zIndex: 1200,
          top: 0,
          left: 0,
          ["& .MuiDrawer-paper"]: {
            width: drawerWidth,
            boxSizing: "border-box",
            overflow: "hidden",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isDrawerOpen ? "translateX(0)" : `translateX(-${drawerWidth}px)`,
            borderRight: "1px solid rgba(0, 0, 0, 0.12)",
            boxShadow: isDrawerOpen ? "4px 0 16px rgba(0, 0, 0, 0.12)" : "none",
            "& .MuiListItemIcon-root, & svg": {
              color: "#29363d",
            },
          },
        }}
      >
        <Toolbar />
        <Box
          sx={{
            opacity: isDrawerOpen ? 1 : 0,
            transition: "opacity 0.2s ease-in-out",
            transitionDelay: isDrawerOpen ? "0.1s" : "0s",
            pointerEvents: isDrawerOpen ? "auto" : "none",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {switchMap[page as keyof typeof switchMap]}
        </Box>
      </Drawer>
      <Box
        component={"main"}
        sx={{
          width: isDrawerOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
          p: 3,
          px: isTemplatePage ? 9 : undefined,
          marginLeft: isDrawerOpen ? `${drawerWidth}px` : 0,
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflowX: "hidden",
          overflowY: "hidden",
          backgroundColor: "#F2F3F7",
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
