import { FC, useState, useEffect } from "react";
import { List, Box, ListItem, ListItemButton, ListItemText, Divider, ListItemIcon } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "@entities/auth";
import { mainTabs } from "../model/consts";
import { Can } from "@shared/ability";

export const MainTabsList: FC = () => {
  const { handleLogOut } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string | null>(location.pathname);

  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location]);

  return (
    <Box sx={{ overflow: "auto" }}>
      <List>
        {mainTabs.map((value) => {
          const isAdminOnly = value.name === "Пользователи" || value.name === "Список компетенций";

          if (isAdminOnly) {
            return (
              <Can I="get" a="admin_tabs" key={value.name}>
                <>
                  {value.name === "Выйти" && <Divider />}
                  <ListItem
                    onClick={
                      value.name === "Выйти"
                        ? handleLogOut
                        : () => {
                            if (value.path) {
                              navigate(value.path);
                              setActiveTab(value.path);
                            }
                          }
                    }
                    disablePadding
                    sx={{
                      width: "100%",
                    }}
                  >
                    <ListItemButton
                      sx={{
                        width: "100%",
                        py: 1.5,
                        bgcolor: activeTab === value.path ? "#f1f1f1" : "inherit",
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          marginLeft: 2,
                        }}
                      >
                        {value.icon}
                      </ListItemIcon>
                      <ListItemText primary={value.name} />
                    </ListItemButton>
                  </ListItem>
                </>
              </Can>
            );
          }

          return (
            <>
              {value.name === "Выйти" && <Divider />}
              <ListItem
                key={value.name}
                onClick={
                  value.name === "Выйти"
                    ? handleLogOut
                    : () => {
                        if (value.path) {
                          navigate(value.path);
                          setActiveTab(value.path);
                        }
                      }
                }
                disablePadding
                sx={{
                  width: "100%",
                }}
              >
                <ListItemButton
                  sx={{ width: "100%", py: 1.5, bgcolor: activeTab === value.path ? "#f1f1f1" : "inherit" }}
                >
                  <ListItemIcon
                    sx={{
                      marginLeft: 2,
                    }}
                  >
                    {value.icon}
                  </ListItemIcon>
                  <ListItemText primary={value.name} />
                </ListItemButton>
              </ListItem>
            </>
          );
        })}
      </List>
    </Box>
  );
};
