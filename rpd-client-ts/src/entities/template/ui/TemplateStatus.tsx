import { Box } from "@mui/material";
import { getTemplateStatusLabel } from "../lib/getTemplateStatusLabel";
import { formatProgress } from "../lib/formatProgress";
import type {
  TemplateStatusCode,
  TemplateParticipant,
} from "../model/workflow";
import { TemplateParticipantsList } from "./TemplateParticipantsList";

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
        <Box sx={{ mt: 1 }}>
          <TemplateParticipantsList participants={participants} />
        </Box>
      ) : null}
    </Box>
  );
}
