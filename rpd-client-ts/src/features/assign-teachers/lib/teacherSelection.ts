import type { TemplateParticipant } from "@entities/template";
import type { AssignableTeacher } from "@entities/user";
import { orderTeacherOptions, type TeacherHint } from "./orderTeacherOptions";

export function selectedParticipants(
  templateId: number | null | undefined,
  participants: TemplateParticipant[],
  users: AssignableTeacher[],
  selectedIds: number[]
): Pick<TemplateParticipant, "userId" | "fullname" | "state" | "isActive">[] {
  if (templateId != null) return participants;
  return users
    .filter((user) => selectedIds.includes(user.id))
    .map((user) => ({
      userId: user.id,
      fullname: user.fullname,
      state: "assigned",
      isActive: true,
    }));
}

export function prepareTeacherOptions(
  users: AssignableTeacher[],
  participants: TemplateParticipant[],
  selectedIds: number[],
  hints: TeacherHint[],
  search: string
) {
  const matchedIds = new Set(hints.map((hint) => hint.userId));
  const query = search.trim().toLocaleLowerCase("ru");
  const options = [
    ...users.map((user) => ({ ...user, isActive: true, canAssign: true })),
    ...participants
      .filter(
        (participant) => !users.some((user) => user.id === participant.userId)
      )
      .map((participant) => ({
        id: participant.userId,
        fullname: participant.fullname,
        isActive: participant.isActive,
        canAssign: false,
      })),
  ];
  return {
    options: orderTeacherOptions(options, hints)
      .filter((option) =>
        option.fullname.toLocaleLowerCase("ru").includes(query)
      )
      .map((option) => ({
        ...option,
        selected: selectedIds.includes(option.id),
        from1c: matchedIds.has(option.id),
      })),
    unmatchedNames: hints
      .filter((hint) => hint.userId === null)
      .map((hint) => hint.name),
  };
}

export function assignmentsDisabled(status: string, canEditTeachers: boolean) {
  return status === "ready" || !canEditTeachers;
}
