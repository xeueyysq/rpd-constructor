import { AuthContext } from "@entities/auth";
import { Logout } from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { FC, MouseEvent, useContext, useState } from "react";

const AccountMenuButton: FC = () => {
  const { handleLogOut } = useContext(AuthContext);

  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box pb={0.25}>
      <IconButton
        id="basic-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        color="inherit"
      >
        <PersonIcon sx={{ fontSize: "37.5px" }} />
      </IconButton>
      <Menu
        slotProps={{
          paper: {
            style: {
              width: "225px",
              marginTop: 5,
            },
          },
        }}
        id="basic-menu"
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
};

export default AccountMenuButton;
