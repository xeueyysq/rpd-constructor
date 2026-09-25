import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  ListItemIcon,
} from "@mui/material";
import { FC } from "react";
import type { RpdListItem, RpdSelectionItem } from "../model/types.ts";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useNavigate } from "react-router-dom";
import { RedirectPath } from "@shared/enums.ts";

type RpdListItemProps =
  | {
      item: RpdListItem;
      templateId: string | undefined;
      templatePage: string | undefined;
      onSelect?: never;
      selectedId?: never;
    }
  | {
      item: RpdSelectionItem;
      onSelect: (id: string) => void;
      selectedId: string;
      templateId?: never;
      templatePage?: never;
    };

const RpdListItem: FC<RpdListItemProps> = (props) => {
  const { id, text } = props.item;
  const navigate = useNavigate();
  const isActive = props.onSelect
    ? props.selectedId === id
    : props.templatePage === props.item.path;

  return (
    <ListItem disableGutters disablePadding>
      <ListItemButton
        onClick={() => {
          if (props.onSelect) {
            props.onSelect(id);
          } else {
            navigate(
              `${RedirectPath.TEMPLATES}/${props.templateId}/${props.item.path}`
            );
          }
        }}
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
        <ListItemText
          primary={<Typography sx={{ fontSize: "14px" }}>{text}</Typography>}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default RpdListItem;
