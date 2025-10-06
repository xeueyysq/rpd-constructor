import { FC } from "react";
import { List, Box, ListItem, ListItemButton, ListItemText, Divider, ListItemIcon } from "@mui/material";
import { complectTabs } from "../model/consts";
import { useStore } from "@shared/hooks";
import { useNavigate } from "react-router-dom";

// interface ComplectTabsListProps {
//   setIsMain: (value: boolean) => void;
//   setPage: (page: ReactNode) => void;
// }

export const ComplectTabsList: FC = () => {
  const { tabs, setManagerPage } = useStore();
  const navigate = useNavigate();
  const isPath = (path: string) => {
    return path[0] === "/";
  };
  return (
    <Box sx={{ overflow: "auto" }}>
      <List>
        {complectTabs.map((value) => (
          <>
            {value.name === "Назад" && <Divider />}
            <ListItem
              key={value.name}
              onClick={() => {
                if (value.name !== "Назад" && !tabs[value.page]?.isEnabled) {
                  return;
                } else if (isPath(value.page)) {
                  navigate(value.page);
                } else setManagerPage(value.page);
              }}
              disablePadding
              sx={{ width: "100%" }}
            >
              <ListItemButton
                disabled={value.name !== "Назад" && !tabs[value.page]?.isEnabled}
                sx={{ width: "100%", py: 2 }}
              >
                <ListItemIcon sx={{ marginLeft: 2 }}>{value.icon}</ListItemIcon>
                <ListItemText primary={value.name} />
              </ListItemButton>
            </ListItem>
          </>
        ))}
      </List>
    </Box>
  );
};
