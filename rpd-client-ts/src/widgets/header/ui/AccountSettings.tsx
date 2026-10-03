import { AuthContext, useAuth } from "@entities/auth";
import { getRoleLabel } from "@entities/auth";
import Logout from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { MouseEvent, useContext, useState } from "react";
import { useRoleSwitch } from "../model/useRoleSwitch";
import { RoleSwitchMenuItems } from "./RoleSwitchMenuItems";

export function AccountSettings() {
  const { handleLogOut } = useContext(AuthContext);
  const userName = useAuth((state) => state.userName);
  const userRole = useAuth((state) => state.userRole);
  const { availableRoles, handleSwitchRole, canSwitchRoles } = useRoleSwitch();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl((prev) => (prev ? null : event.currentTarget));
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Box
        role="button"
        tabIndex={0}
        aria-label="Открыть меню аккаунта"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as MouseEvent<HTMLElement>);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          "&:focus-visible": (theme) => ({
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
            borderRadius: 6,
          }),
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.5,
            pb: 0.5,
          }}
        >
          <Box sx={{ fontSize: "15px" }}>{userName}</Box>
          <Box
            sx={{
              fontSize: "12px",
              fontWeight: 400,
              color: "#B2B2B2",
            }}
          >
            {getRoleLabel(userRole)}
          </Box>
        </Box>
        <Box sx={{ pl: 2, pb: 0.25 }}>
          <PersonIcon sx={{ display: "block", m: 0.625, fontSize: "37.5px" }} />
        </Box>
      </Box>
      <Menu
        id="basic-menu"
        slotProps={{
          paper: {
            style: {
              minWidth: canSwitchRoles ? 280 : 225,
              marginTop: 5,
            },
          },
        }}
        // Длинное название роли РОП не помещается в 280 px: меню растёт влево от правого края кнопки.
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {canSwitchRoles ? (
          <RoleSwitchMenuItems
            availableRoles={availableRoles}
            activeRole={userRole}
            onSwitch={handleSwitchRole}
            onClose={handleClose}
          />
        ) : null}
        <MenuItem disabled>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography sx={{ display: "block" }} variant="button" color="grey">
              Настройки
            </Typography>
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            handleLogOut();
          }}
        >
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText>
            <Typography sx={{ display: "block" }} variant="button" color="grey">
              Выйти
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
