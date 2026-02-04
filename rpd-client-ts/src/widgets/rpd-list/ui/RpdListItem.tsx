import { ListItem, ListItemButton, ListItemText, Typography, ListItemIcon } from "@mui/material";
import { FC } from "react";
import type { RpdListItem } from "../model/types.ts";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useNavigate } from "react-router-dom";
import { RedirectPath } from "@shared/enums.ts";

type RpdListItemProps = {
  item: RpdListItem;
  templateId: string | undefined;
  templatePage: string | undefined;
};

const RpdListItem: FC<RpdListItemProps> = ({ item, templateId, templatePage }) => {
  const { id, text, path } = item;
  const navigate = useNavigate();
  const isActive = templatePage === path;

  return (
    <ListItem disableGutters disablePadding>
      <ListItemButton
        onClick={() => navigate(`${RedirectPath.TEMPLATES}/${templateId}/${path}`)}
        sx={{
          py: 0.15,
          pl: 0.5,
          width: "100%",
          bgcolor: isActive ? "#f1f1f1" : "#ffffff",
          "&:hover": {
            bgcolor: "#f1f1f1",
          },
          transition: "background-color 0.2s ease",
        }}
        disabled={id === "approvalPage"}
      >
        <ListItemIcon sx={{ pl: 4 }}>
          <FiberManualRecordIcon sx={{ fontSize: "5px" }} />
        </ListItemIcon>
        <ListItemText primary={<Typography fontSize={"14px"}>{text}</Typography>} />
      </ListItemButton>
    </ListItem>
  );
};

export default RpdListItem;
