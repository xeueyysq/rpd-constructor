import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";
import { Header } from "@widgets/header";
import { FC } from "react";
import { Outlet } from "react-router-dom";
import { MainTabsList } from "@widgets/tabs-list";
import { RpdList } from "@widgets/rpd-list";
import { useState } from "react";
import { TeacherRpdListItems } from "@pages/teacher-interface/model/teacherInterfaceItems";
import { useEffect } from "react";
import { TeacherTabsList } from "@widgets/tabs-list";
import { useStore } from "@shared/hooks";
interface ClippedDrawerProps {
  page: string;
}

export const ClippedDrawer: FC<ClippedDrawerProps> = ({ page }) => {
  // const userRole = useAuth.getState().userRole;
  const [setChoise] = useState<string>("coverPage");
  const [drawerWidth, setDrawerWidth] = useState<number>(270);
  const { isDrawerOpen } = useStore();

  useEffect(() => {
    if (page === "template") setDrawerWidth(430);
    else setDrawerWidth(270);
  }, [page]);

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
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: "100vh",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isDrawerOpen ? "translateX(0)" : `translateX(-${drawerWidth}px)`,
            borderRight: "1px solid rgba(0, 0, 0, 0.12)",
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
            height: "100%",
          }}
        >
          {page === "teacher" && <TeacherTabsList />}
          {page === "main" && <MainTabsList />}
          {page === "template" && <RpdList setChoise={() => setChoise} RpdListItems={TeacherRpdListItems} />}
        </Box>
      </Drawer>
      <Box
        component={"main"}
        sx={{
          width: isDrawerOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
          p: 3,
          marginLeft: isDrawerOpen ? `${drawerWidth}px` : 0,
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflowX: "hidden",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};
