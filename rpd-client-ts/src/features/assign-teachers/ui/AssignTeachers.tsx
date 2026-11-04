import type { TemplateParticipant } from "@entities/template";
import { Box } from "@mui/material";
import { StatusWithSubtext } from "@shared/ui";
import { participantSubtext } from "../lib/participantSubtext";
import { assignmentsDisabled } from "../lib/teacherSelection";

interface Props {
  templateId?: number | null;
  status: string;
  participants: TemplateParticipant[];
  canEditTeachers: boolean;
  onOpen: () => void;
}

export function AssignTeachers({
  templateId,
  status,
  participants,
  canEditTeachers,
  onOpen,
}: Props) {
  const canEdit =
    templateId != null && !assignmentsDisabled(status, canEditTeachers);
  const selected = participants;
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
