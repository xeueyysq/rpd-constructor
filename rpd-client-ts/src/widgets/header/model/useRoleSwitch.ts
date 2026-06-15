import { useAuth } from "@entities/auth";
import { getDefaultPathForRole } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function useRoleSwitch() {
  const navigate = useNavigate();
  const switchRole = useAuth((state) => state.switchRole);
  const userRole = useAuth((state) => state.userRole);
  const availableRoles = useAuth((state) => state.availableRoles);

  const handleSwitchRole = useCallback(
    (role: UserRole) => {
      if (role === userRole) return;
      switchRole(role);
      navigate(getDefaultPathForRole(role));
    },
    [navigate, switchRole, userRole]
  );

  return {
    userRole,
    availableRoles,
    handleSwitchRole,
    canSwitchRoles: availableRoles.length > 1,
  };
}
