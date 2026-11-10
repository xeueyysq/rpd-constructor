import { useAssignComplectOwners } from "@entities/rpd-complect";
import { useUsers, type User } from "@entities/user";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  FormGroup,
  TextField,
  Typography,
} from "@mui/material";
import { UserRole } from "@shared/ability";
import { formatFullName } from "@shared/lib";
import type { ComplectData } from "@shared/types";
import { useId, useRef, useState } from "react";
import { isAxiosError } from "axios";

const userName = (user: User) => formatFullName(user.fullname) || user.name;

// Оформление как у диалога «Преподаватели: …»: поиск, список, выбор применяется сразу.
export function AssignOwnerDialog({
  complect,
  onClose,
}: {
  complect: ComplectData;
  onClose: () => void;
}) {
  const titleId = useId();
  const { data: users = [], isPending, isError } = useUsers();
  const mutation = useAssignComplectOwners();
  const [search, setSearch] = useState("");
  // Подтверждённый сервером состав — база следующей записи, независимо от поиска.
  const [ownerIds, setOwnerIds] = useState(
    () => complect.owner?.map((owner) => owner.userId) ?? []
  );
  const [saveError, setSaveError] = useState("");
  const saving = useRef(false);
  const query = search.trim().toLocaleLowerCase("ru");
  const activeRopIds = new Set(
    users
      .filter((user) => user.role === UserRole.ROP && user.is_active)
      .map((user) => user.id)
  );
  const invalidOwners = ownerIds
    .filter((id) => !activeRopIds.has(id))
    .map((id) => {
      const user = users.find((user) => user.id === id);
      return (
        (user
          ? userName(user)
          : complect.owner?.find((owner) => owner.userId === id)?.fullname) ||
        `Пользователь №${id}`
      );
    });
  const rops = users
    .filter(
      (user) =>
        (user.role === UserRole.ROP && user.is_active) ||
        ownerIds.includes(user.id)
    )
    .map((user) => ({ id: user.id, label: userName(user) }))
    .filter((user) => user.label.toLocaleLowerCase("ru").includes(query))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  const assign = async (userId: number, checked: boolean) => {
    if (saving.current) return;
    saving.current = true;
    setSaveError("");
    // Цель содержит только активных РОП, база — все связи, включая прежних владельцев.
    const userIds = ownerIds.filter(
      (id) => activeRopIds.has(id) && id !== userId
    );
    if (checked && activeRopIds.has(userId)) userIds.push(userId);
    try {
      const result = await mutation.mutateAsync({
        complectId: complect.id,
        userIds,
        baseUserIds: ownerIds,
      });
      setOwnerIds(result.userIds);
    } catch (error) {
      if (
        isAxiosError<{
          error?: string | { message?: string; userIds?: number[] };
        }>(error)
      ) {
        const detail = error.response?.data.error;
        if (
          error.response?.status === 409 &&
          typeof detail === "object" &&
          Array.isArray(detail.userIds)
        ) {
          setOwnerIds(detail.userIds);
          setSaveError(
            "Состав РОП изменён другим администратором. Список обновлён; повторите выбор."
          );
        } else {
          setSaveError(
            typeof detail === "string"
              ? detail
              : detail?.message ||
                  "Не удалось изменить состав РОП. Повторите попытку."
          );
        }
      } else {
        setSaveError("Не удалось изменить состав РОП. Повторите попытку.");
      }
    } finally {
      saving.current = false;
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id={titleId}>
        РОП: {complect.profile} {complect.year}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Поиск РОП"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {!isPending && !isError && invalidOwners.length ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Без активной роли РОП: {invalidOwners.join(", ")}. При следующем
            изменении состава эти назначения будут сняты. Остальные активные РОП
            сохранятся.
          </Alert>
        ) : null}
        {saveError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {saveError}
          </Alert>
        ) : null}
        {isPending ? (
          <Typography sx={{ color: "text.secondary", mt: 2 }}>
            Загрузка пользователей…
          </Typography>
        ) : isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Не удалось загрузить пользователей
          </Alert>
        ) : rops.length ? (
          <FormGroup role="group" aria-label="РОП" sx={{ mt: 1 }}>
            {rops.map((rop) => (
              <Box key={rop.id}>
                <FormControlLabel
                  value={rop.id}
                  disabled={mutation.isPending}
                  control={
                    <Checkbox
                      checked={ownerIds.includes(rop.id)}
                      onChange={(event) =>
                        void assign(rop.id, event.target.checked)
                      }
                    />
                  }
                  label={rop.label}
                  sx={{
                    width: "100%",
                    m: 0,
                    alignItems: "flex-start",
                    "& .MuiFormControlLabel-label": {
                      py: 1,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    },
                  }}
                />
              </Box>
            ))}
          </FormGroup>
        ) : (
          <Typography sx={{ color: "text.secondary", mt: 2 }}>
            Не найдено
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={mutation.isPending} onClick={onClose}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
