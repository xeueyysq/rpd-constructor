import type { TemplateParticipant } from "@entities/template";
import { useAssignableTeachers } from "@entities/user";
import { Box } from "@mui/material";
import { StatusWithSubtext } from "@shared/ui";
import { participantSubtext } from "../lib/participantSubtext";
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
  const selected = selectedParticipants(
    templateId,
    participants,
    users,
    selectedIds
  );
  if (!selected.length) {
    return (
      <StatusWithSubtext
        label={
          canEdit ? "Назначить преподавателей" : "Преподаватели не назначены"
        }
        onClick={canEdit ? onOpen : undefined}
        underline={canEdit}
      />
    );
  }
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {selected.map((participant) => (
        <Box
          component="li"
          key={participant.userId}
          sx={{ "& + &": { mt: (theme) => theme.spacing(1) } }}
        >
          <StatusWithSubtext
            label={participant.fullname}
            subtext={participantSubtext(participant)}
            onClick={onOpen}
          />
        </Box>
      ))}
    </Box>
  );
}
