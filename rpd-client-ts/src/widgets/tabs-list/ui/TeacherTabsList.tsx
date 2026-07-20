import { FC, Fragment, useEffect, useState } from "react";
import {
  List,
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  ListItemIcon,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "@entities/auth";
import { teacherTabs, TabItem } from "../model/consts";

export const TeacherTabsList: FC = () => {
  const { handleLogOut } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string | null>(location.pathname);

  const handleItemClick = (value: TabItem) => {
    if (value.name === "Выйти") {
      handleLogOut();
      return;
    }
    if (value.href) {
      window.open(value.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (value.path) navigate(value.path);
  };

  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location]);

  return (
    <Box sx={{ overflow: "auto" }}>
      <List disablePadding>
        {teacherTabs.map((value) => (
          <Fragment key={value.name}>
            {value.name === "Выйти" && <Divider />}
            <ListItem
              onClick={() => handleItemClick(value)}
              disablePadding
              sx={{ width: "100%" }}
            >
              <ListItemButton
                disabled={value.path === ""}
                sx={{
                  width: "100%",
                  py: 1.25,
                  bgcolor: activeTab === value.path ? "#f1f1f1" : "inherit",
                  pl: 1.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    pl: 2,
                    "& .MuiSvgIcon-root": {
                      fontSize: "20px",
                    },
                  }}
                >
                  {value.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography fontSize={"14px"}>{value.name}</Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          </Fragment>
        ))}
      </List>
    </Box>
  );
};
