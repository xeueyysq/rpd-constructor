import { useAssignComplectOwner } from "@entities/rpd-complect";
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
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { UserRole } from "@shared/ability";
import { formatFullName, showErrorMessage } from "@shared/lib";
import type { ComplectData } from "@shared/types";
import { useId, useState } from "react";

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
  const mutation = useAssignComplectOwner();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("ru");
  const rops = users
    .filter((user) => user.role === UserRole.ROP && user.is_active)
    .map((user) => ({ id: user.id, label: userName(user) }))
    .filter((user) => user.label.toLocaleLowerCase("ru").includes(query))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  const ownerId = complect.owner?.[0]?.userId ?? null;

  const assign = async (userId: number) => {
    try {
      await mutation.mutateAsync({ complectId: complect.id, userId });
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось назначить РОП");
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
        {isPending ? (
          <Typography sx={{ color: "text.secondary", mt: 2 }}>
            Загрузка пользователей…
          </Typography>
        ) : isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Не удалось загрузить пользователей
          </Alert>
        ) : rops.length ? (
          <RadioGroup
            aria-label="РОП"
            value={ownerId ?? ""}
            onChange={(_, value) => void assign(Number(value))}
            sx={{ mt: 1 }}
          >
            {rops.map((rop) => (
              <Box key={rop.id}>
                <FormControlLabel
                  value={rop.id}
                  disabled={mutation.isPending}
                  control={<Radio />}
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
          </RadioGroup>
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
