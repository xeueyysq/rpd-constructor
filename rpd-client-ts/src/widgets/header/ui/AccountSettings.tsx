import { AuthContext, useAuth } from "@entities/auth";
import { Logout } from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { MouseEvent, useContext, useMemo, useState } from "react";
import { UserRole } from "@shared/ability";

export function AccountSettings() {
  const { handleLogOut } = useContext(AuthContext);
  const userName = useAuth.getState().userName;
  const userRole = useAuth.getState().userRole;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl((prev) => (prev ? null : event.currentTarget));
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const userRoleLocale = useMemo(() => {
    switch (userRole) {
      case UserRole.ADMIN:
        return "Администратор";
      case UserRole.TEACHER:
        return "Преподаватель";
      case UserRole.ROP:
        return "Руководитель образовательной программы";
      default:
        return "Неавторизованный пользователь";
    }
  }, [userRole]);

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-controls={open ? "basic-menu" : undefined}
      aria-haspopup="true"
      aria-expanded={open ? "true" : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          handleClick(e as unknown as MouseEvent<HTMLElement>);
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
        <Box
          sx={{
            fontSize: "15px",
          }}
        >
          {userName}
        </Box>
        <Box
          sx={{
            fontSize: "12px",
            fontWeight: 400,
            color: "#B2B2B2",
          }}
        >
          {userRoleLocale}
        </Box>
      </Box>
      <Box sx={{ pl: 2 }}>
        <Box pb={0.25}>
          <IconButton color="inherit" aria-label="Открыть меню аккаунта">
            <PersonIcon sx={{ fontSize: "37.5px" }} />
          </IconButton>
        </Box>
      </Box>
      <Menu
        id="basic-menu"
        slotProps={{
          paper: {
            style: {
              width: "225px",
              marginTop: 5,
            },
          },
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="button" display="block" color="grey">
              Настройки
            </Typography>
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleLogOut}>
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="button" display="block" color="grey">
              Выйти
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
