import { Box, Typography } from "@mui/material";
import {
  participationLabels,
  type TemplateParticipant,
} from "../model/workflow";

export function TemplateParticipantsList({
  participants,
}: {
  participants: Pick<
    TemplateParticipant,
    "userId" | "fullname" | "state" | "isActive"
  >[];
}) {
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {participants.map((participant) => (
        <Box
          component="li"
          key={participant.userId}
          sx={{ "& + &": { mt: 1 } }}
        >
          <Typography
            variant="body2"
            sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
          >
            {participant.fullname}
            {participant.isActive ? "" : " (неактивен)"}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {participationLabels[participant.state]}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
