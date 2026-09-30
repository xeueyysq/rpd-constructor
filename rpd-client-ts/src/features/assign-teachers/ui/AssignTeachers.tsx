import {
  TemplateParticipantsList,
  type TemplateParticipant,
} from "@entities/template";
import { useAssignableTeachers } from "@entities/user";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  assignmentsDisabled,
  selectedParticipants,
} from "../lib/teacherSelection";

interface Props {
  templateId?: number | null;
  status: string;
  participants: TemplateParticipant[];
  canEditTeachers: boolean;
  selectedIds: number[];
  onOpen: () => void;
}

export function AssignTeachers({
  templateId,
  status,
  participants,
  canEditTeachers,
  selectedIds,
  onOpen,
}: Props) {
  const { data: users = [] } = useAssignableTeachers();
  const canEdit = !assignmentsDisabled(status, canEditTeachers);
  const label = canEdit
    ? "Изменить преподавателей"
    : "Просмотреть преподавателей";

  return (
    <Box
      sx={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 1 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <TemplateParticipantsList
          participants={selectedParticipants(
            templateId,
            participants,
            users,
            selectedIds
          )}
        />
      </Box>
      {canEdit || status === "ready" ? (
        <Tooltip title={label}>
          <IconButton
            aria-label={label}
            onClick={onOpen}
            sx={{ flexShrink: 0 }}
          >
            {canEdit ? <EditOutlinedIcon /> : <VisibilityOutlinedIcon />}
          </IconButton>
        </Tooltip>
      ) : null}
    </Box>
  );
}
