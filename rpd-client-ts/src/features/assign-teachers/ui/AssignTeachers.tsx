import {
  useWorkflowAction,
  type TemplateParticipant,
} from "@entities/template";
import { useAssignableTeachers, type AssignableTeacher } from "@entities/user";
import {
  Autocomplete,
  Box,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { showErrorMessage } from "@shared/lib";
import { useState } from "react";
import { diffAssignments } from "../lib/diffAssignments";
import {
  orderTeacherOptions,
  type TeacherHint,
} from "../lib/orderTeacherOptions";

interface Props {
  templateId?: number | null;
  status: string;
  participants: TemplateParticipant[];
  hints: TeacherHint[];
  canEditTeachers: boolean;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  onRefresh: () => Promise<void>;
}

export function AssignTeachers({
  templateId,
  status,
  participants,
  hints,
  canEditTeachers,
  selectedIds,
  onSelectedIdsChange,
  onRefresh,
}: Props) {
  const { data: users = [] } = useAssignableTeachers();
  const workflow = useWorkflowAction();
  const [busy, setBusy] = useState(false);
  const assignedIds = participants.map((participant) => participant.userId);
  const valueIds = templateId ? assignedIds : selectedIds;
  const selectedUsers = valueIds
    .map(
      (id) =>
        users.find((user) => user.id === id) ??
        participants.find((participant) => participant.userId === id)
    )
    .filter((user): user is AssignableTeacher | TemplateParticipant =>
      Boolean(user)
    )
    .map((user) => ({
      id: "userId" in user ? user.userId : user.id,
      fullname: user.fullname,
    }));
  const options = orderTeacherOptions(
    [
      ...users,
      ...selectedUsers.filter(
        (user) => !users.some((candidate) => candidate.id === user.id)
      ),
    ],
    hints
  );
  const matchedIds = new Set(hints.map((hint) => hint.userId));
  const unmatched = hints.filter((hint) => hint.userId === null);
  const disabled = busy || !canEditTeachers;

  const handleChange = async (ids: number[]) => {
    if (!templateId) {
      onSelectedIdsChange(ids);
      return;
    }
    const changes = diffAssignments(assignedIds, ids);
    setBusy(true);
    try {
      for (const userId of changes.unassign)
        await workflow.mutateAsync({ templateId, action: "unassign", userId });
      for (const userId of changes.assign)
        await workflow.mutateAsync({ templateId, action: "assign", userId });
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось изменить состав преподавателей");
    } finally {
      await onRefresh();
      setBusy(false);
    }
  };

  return (
    <Box>
      <Tooltip
        title={
          status === "ready"
            ? "Чтобы изменить состав, верните РПД на доработку"
            : ""
        }
      >
        <span>
          <Autocomplete
            multiple
            fullWidth
            disabled={disabled}
            options={options}
            value={selectedUsers}
            getOptionLabel={(option) => option.fullname}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, next) =>
              void handleChange(next.map((user) => user.id))
            }
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {option.fullname}
                {matchedIds.has(option.id) ? " — из 1С" : ""}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="standard"
                label="Преподаватели"
                aria-label="Преподаватели"
              />
            )}
          />
        </span>
      </Tooltip>
      {participants
        .filter((participant) => !participant.isActive)
        .map((participant) => (
          <Typography
            key={participant.userId}
            variant="caption"
            sx={{ display: "block" }}
          >
            {participant.fullname} (неактивен)
          </Typography>
        ))}
      {unmatched.map((hint) => (
        <Typography key={hint.name} variant="caption" sx={{ display: "block" }}>
          в 1С: {hint.name}, нет аккаунта
        </Typography>
      ))}
    </Box>
  );
}
