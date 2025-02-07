import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import Toolbar from "@mui/material/Toolbar";
import { Header } from "@widgets/header";
import { FC } from "react";
import { Outlet } from "react-router-dom";
import { MainTabsList } from "@widgets/tabs-list";
import { ComplectTabsList } from "@widgets/tabs-list/ui/ComplectTabsList";
import { RpdList } from "@widgets/rpd-list";
import { useState } from "react";
import { UserRole } from "@shared/ability";
import { useAuth } from "@entities/auth";
import { TeacherRpdListItems } from "@pages/teacher-interface/model/teacherInterfaceItems";
import { useEffect } from "react";

interface ClippedDrawerProps {
  page: string;
}

export const ClippedDrawer: FC<ClippedDrawerProps> = ({ page }) => {
  // const userRole = useAuth.getState().userRole;
  const [setChoise] = useState<string>("coverPage");
  const [drawerWidth, setDrawerWidth] = useState<number>(250);
  useEffect(() => {
    if (page === "main" || page === "manager") setDrawerWidth(250);
    if (page === "teacher") setDrawerWidth(430);
  }, [page]);
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", overflow: "auto" }}>
      <CssBaseline />
      <Header />
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          position: "static",
          ["& .MuiDrawer-paper"]: {
            width: drawerWidth,
            boxSizing: "border-box",
            position: "static",
            overflowY: "visible",
            height: "auto",
          },
        }}
      >
        <Toolbar />
        {page === "main" && <MainTabsList />}
        {page === "manager" && <ComplectTabsList />}
        {page === "teacher" && (
          <RpdList
            setChoise={() => setChoise}
            RpdListItems={TeacherRpdListItems}
          />
        )}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};
