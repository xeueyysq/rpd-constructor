import { ListItem, ListItemButton, ListItemText, Typography, ListItemIcon } from "@mui/material";
import { FC } from "react";
import type { RpdListItem } from "../model/types.ts";
import MoreVertIcon from "@mui/icons-material/MoreVert";

type RpdListItemProps = RpdListItem & {
  setChoise: (choise: string) => void;
  activePage?: string;
};

const RpdListItem: FC<RpdListItemProps> = ({ id, text, setChoise, activePage }) => {
  const isActive = activePage === id;

  return (
    <ListItem
      disableGutters
      sx={{
        p: 0,
        py: 0,
      }}
    >
      <ListItemButton
        onClick={() => setChoise(id)}
        sx={{
          px: 3,
          py: 0.15,
          width: "100%",
          bgcolor: isActive ? "#f1f1f1" : "#ffffff",
          "&:hover": {
            bgcolor: "#f1f1f1",
          },
          transition: "background-color 0.2s ease",
        }}
        disabled={id === "approvalPage"}
      >
        <ListItemIcon sx={{ pl: 2 }}>
          <MoreVertIcon />
        </ListItemIcon>
        <ListItemText primary={<Typography sx={{ pl: 0 }}>{text}</Typography>} />
      </ListItemButton>
    </ListItem>
  );
};

export default RpdListItem;
