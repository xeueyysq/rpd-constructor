import { useAssignComplectOwner } from "@entities/rpd-complect";
import { useUsers, type User } from "@entities/user";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { UserRole } from "@shared/ability";
import { showErrorMessage } from "@shared/lib";
import { useState } from "react";

function name(user: User) {
  const fullname = user.fullname;
  return fullname
    ? [fullname.surname, fullname.name, fullname.patronymic]
        .filter(Boolean)
        .join(" ")
    : user.name;
}

export function AssignOwnerDialog({
  complectId,
  onClose,
}: {
  complectId: number | null;
  onClose: () => void;
}) {
  const { data: users = [] } = useUsers();
  const [selected, setSelected] = useState<User | null>(null);
  const mutation = useAssignComplectOwner();
  const save = async () => {
    if (!selected || complectId == null) return;
    try {
      await mutation.mutateAsync({ complectId, userId: selected.id });
      onClose();
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось назначить РОП");
    }
  };
  return (
    <Dialog open={complectId != null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Назначить РОП</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={users.filter(
            (user) => user.role === UserRole.ROP && user.is_active
          )}
          value={selected}
          onChange={(_, value) => setSelected(value)}
          getOptionLabel={name}
          renderInput={(params) => (
            <TextField {...params} label="РОП" sx={{ mt: 1 }} />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          disabled={!selected || mutation.isPending}
          onClick={() => void save()}
        >
          Назначить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
