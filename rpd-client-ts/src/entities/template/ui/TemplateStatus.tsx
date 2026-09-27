import { Box, Chip, Stack } from "@mui/material";
import { getTemplateStatusLabel } from "../lib/getTemplateStatusLabel";
import { formatProgress } from "../lib/formatProgress";
import type {
  TemplateStatusCode,
  TemplateParticipant,
} from "../model/workflow";
import { participationLabels } from "../model/workflow";

type TemplateStatusProps = {
  status: TemplateStatusCode | null | undefined;
  progress?: { done: number; total: number };
  participants?: TemplateParticipant[];
};

export function TemplateStatus({
  status,
  progress,
  participants,
}: TemplateStatusProps) {
  if (!status) return null;
  return (
    <Box>
      <Box>{getTemplateStatusLabel(status)}</Box>
      {progress ? <Box>{formatProgress(progress)}</Box> : null}
      {participants?.length ? (
        <Stack direction="row" sx={{ mt: 0.5, gap: 0.5, flexWrap: "wrap" }}>
          {participants.map((participant) => (
            <Chip
              key={participant.userId}
              size="small"
              label={`${participant.fullname} — ${participationLabels[participant.state]}${participant.isActive ? "" : " (неактивен)"}`}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
