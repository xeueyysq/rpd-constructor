import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DialogActions,
  Button,
  SelectChangeEvent,
  Divider,
} from "@mui/material";
import type { NewUser } from "../model/types";
import { UserRole } from "@shared/ability";
import { useState, KeyboardEvent } from "react";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Selectors } from "@features/select-template-data";

type DialogAddUserType = {
  open: boolean;
  setOpen: (param: boolean) => void;
  fetchUsers: () => Promise<void>;
};

export function DialogAddUser({ open, setOpen, fetchUsers }: DialogAddUserType) {
  const [newUser, setNewUser] = useState<NewUser>({
    username: "",
    password: "",
    role: UserRole.TEACHER,
    name: "",
    surname: "",
    patronymic: "",
  });

  const handleChange =
    (prop: keyof NewUser) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { value: unknown }>) => {
      setNewUser({ ...newUser, [prop]: event.target.value });
    };

  const handleSubmit = async () => {
    try {
      const userData = {
        newUser: {
          username: newUser.username,
          hashedPassword: newUser.password,
          role: newUser.role,
          fullname: {
            name: newUser.name,
            surname: newUser.surname,
            patronymic: newUser.patronymic,
          },
        },
      };

      await axiosBase.post("add-user", userData);
      showSuccessMessage("Пользователь успешно добавлен");
      handleClose();
      fetchUsers();
    } catch (error) {
      showErrorMessage("Ошибка при добавлении пользователя");
      console.error(error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") e.preventDefault();
  };

  const handleRoleChange = (event: SelectChangeEvent<UserRole>) => {
    const newRole = event.target.value;
    setNewUser({ ...newUser, role: newRole as UserRole });
  };

  const handleClose = () => {
    setOpen(false);
    setNewUser({
      username: "",
      password: "",
      role: UserRole.TEACHER,
      name: "",
      surname: "",
      patronymic: "",
    });
  };

  return (
    <FormControl>
      <Dialog fullWidth maxWidth={"xs"} open={open} onClose={handleClose} component={"form"} onSubmit={handleSubmit}>
        <DialogTitle>Новый пользователь</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <FormControl>
              <InputLabel>Роль</InputLabel>
              <Select<UserRole>
                variant="standard"
                size="small"
                value={newUser.role}
                label="Роль"
                onChange={handleRoleChange}
              >
                <MenuItem value={UserRole.ROP}>РОП</MenuItem>
                <MenuItem value={UserRole.TEACHER}>Преподаватель</MenuItem>
              </Select>
            </FormControl>
            <TextField
              required
              label="Логин"
              value={newUser.username}
              onChange={handleChange("username")}
              onKeyDown={handleKeyDown}
              variant="standard"
            />
            <TextField
              required
              label="Пароль"
              type="password"
              value={newUser.password}
              onChange={handleChange("password")}
              onKeyDown={handleKeyDown}
              variant="standard"
            />
            <TextField
              required
              label="Фамилия"
              value={newUser.surname}
              onChange={handleChange("surname")}
              onKeyDown={handleKeyDown}
              variant="standard"
            />
            <TextField
              required
              label="Имя"
              value={newUser.name}
              onChange={handleChange("name")}
              onKeyDown={handleKeyDown}
              variant="standard"
            />
            <TextField
              required
              label="Отчество"
              value={newUser.patronymic}
              onChange={handleChange("patronymic")}
              onKeyDown={handleKeyDown}
              variant="standard"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Отмена</Button>
          <Button type="submit" variant="contained">
            Добавить
          </Button>
        </DialogActions>
      </Dialog>
    </FormControl>
  );
}
