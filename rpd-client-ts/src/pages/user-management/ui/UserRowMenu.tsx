import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { useId, useState, type MouseEvent } from "react";

interface Props {
  isActive: boolean;
  onEdit: () => void;
  onActivate: () => void;
}

export function UserRowMenu({ isActive, onEdit, onActivate }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const menuId = useId();
  const close = () => setAnchorEl(null);
  return (
    <>
      <IconButton
        aria-label="Действия строки"
        aria-haspopup="menu"
        aria-controls={anchorEl ? menuId : undefined}
        aria-expanded={Boolean(anchorEl)}
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
      >
        <MenuItem
          onClick={() => {
            close();
            onEdit();
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon />
          </ListItemIcon>
          Редактировать
        </MenuItem>
        {!isActive ? (
          <MenuItem
            onClick={() => {
              close();
              onActivate();
            }}
          >
            <ListItemIcon>
              <CheckCircleOutlineOutlinedIcon />
            </ListItemIcon>
            Активировать
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}
