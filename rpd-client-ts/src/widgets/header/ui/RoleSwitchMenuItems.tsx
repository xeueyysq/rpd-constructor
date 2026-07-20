import { getRoleLabel } from "@entities/auth";
import CheckIcon from "@mui/icons-material/Check";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Typography,
} from "@mui/material";
import { UserRole } from "@shared/ability";

type RoleSwitchMenuItemsProps = {
  availableRoles: UserRole[];
  activeRole: UserRole;
  onSwitch: (role: UserRole) => void;
  onClose: () => void;
};

export function RoleSwitchMenuItems({
  availableRoles,
  activeRole,
  onSwitch,
  onClose,
}: RoleSwitchMenuItemsProps) {
  const switchableRoles = availableRoles.filter(
    (role) => role === UserRole.ROP || role === UserRole.TEACHER
  );

  if (switchableRoles.length <= 1) return null;

  return (
    <>
      {switchableRoles.map((role) => (
        <MenuItem
          key={role}
          selected={role === activeRole}
          onClick={() => {
            onSwitch(role);
            onClose();
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {role === activeRole ? (
              <CheckIcon fontSize="small" />
            ) : (
              <span style={{ width: 20 }} />
            )}
          </ListItemIcon>
          <ListItemText>
            <Typography variant="button" display="block" color="grey">
              {getRoleLabel(role)}
            </Typography>
          </ListItemText>
        </MenuItem>
      ))}
      <Divider />
    </>
  );
}
