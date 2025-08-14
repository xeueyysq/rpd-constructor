import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
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
import { TeacherTabsList } from "@widgets/tabs-list";
interface ClippedDrawerProps {
  page: string;
}

export const ClippedDrawer: FC<ClippedDrawerProps> = ({ page }) => {
  // const userRole = useAuth.getState().userRole;
  const [setChoise] = useState<string>("coverPage");
  const [drawerWidth, setDrawerWidth] = useState<number>(270);

  useEffect(() => {
    if (page === "template") setDrawerWidth(430);
    else setDrawerWidth(270);
  }, [page]);

  return (
    <Box sx={{ display: "flex", overflow: "auto" }}>
      <Header />
      <Drawer
        color="default"
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          ["& .MuiDrawer-paper"]: {
            width: drawerWidth,
            boxSizing: "border-box",
            overflowY: "visible",
            minHeight: "100vh",
          },
        }}
      >
        <Toolbar />
        {page === "teacher" && <TeacherTabsList />}
        {page === "main" && <MainTabsList />}
        {page === "manager" && <ComplectTabsList />}
        {page === "template" && (
          <RpdList
            setChoise={() => setChoise}
            RpdListItems={TeacherRpdListItems}
          />
        )}
      </Drawer>
      <Box component={"main"} sx={{ flexGrow: 1, p: 3, width: "60%" }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};
