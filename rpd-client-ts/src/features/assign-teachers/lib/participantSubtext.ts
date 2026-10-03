import {
  participationLabels,
  type TemplateParticipant,
} from "@entities/template";

export function participantSubtext(
  participant: Pick<TemplateParticipant, "state" | "isActive">
) {
  return `${participationLabels[participant.state]}${participant.isActive ? "" : " (неактивен)"}`;
}
