import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { UserRole } from "@shared/ability";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { getRoleLabel } from "@entities/auth";
import { useCreateUser, useUpdateUser, type User } from "@entities/user";
import axios from "axios";
import { useEffect, useMemo } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import {
  buildUserPayload,
  getUserFormDefaults,
  getUserFormSchema,
  type UserFormValues,
} from "../lib/userForm";

interface UserFormDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

export function UserFormDialog({ open, user, onClose }: UserFormDialogProps) {
  const isEditing = user !== null;
  const schema = useMemo(() => getUserFormSchema(isEditing), [isEditing]);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const {
    control,
    register,
    reset,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: yupResolver(schema),
    defaultValues: getUserFormDefaults(user),
  });

  useEffect(() => {
    if (open) reset(getUserFormDefaults(user));
  }, [open, user, reset]);

  const onSubmit: SubmitHandler<UserFormValues> = async (values) => {
    const payload = buildUserPayload(values, isEditing);
    try {
      if (user) {
        await updateUser.mutateAsync({ id: user.id, payload });
      } else {
        await createUser.mutateAsync(payload);
      }
      showSuccessMessage(
        user ? "Пользователь обновлён" : "Пользователь добавлен"
      );
      onClose();
    } catch (error) {
      if (
        axios.isAxiosError<{ error?: string }>(error) &&
        error.response?.status === 409
      ) {
        setError("name", {
          message:
            error.response.data?.error ??
            "Пользователь с таким логином уже существует",
        });
        return;
      }
      showErrorMessage(
        user
          ? "Не удалось обновить пользователя"
          : "Не удалось добавить пользователя"
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle>
          {isEditing ? "Редактирование пользователя" : "Новый пользователь"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Логин"
              autoComplete="off"
              fullWidth
              required
              size="small"
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              {...register("name")}
            />
            <TextField
              label="Фамилия"
              fullWidth
              required
              size="small"
              error={Boolean(errors.surname)}
              helperText={errors.surname?.message}
              {...register("surname")}
            />
            <TextField
              label="Имя"
              fullWidth
              required
              size="small"
              error={Boolean(errors.givenName)}
              helperText={errors.givenName?.message}
              {...register("givenName")}
            />
            <TextField
              label="Отчество"
              fullWidth
              size="small"
              error={Boolean(errors.patronymic)}
              helperText={errors.patronymic?.message}
              {...register("patronymic")}
            />
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <FormControl
                  fullWidth
                  size="small"
                  error={Boolean(errors.role)}
                >
                  <InputLabel id="user-role-label">Роль</InputLabel>
                  <Select labelId="user-role-label" label="Роль" {...field}>
                    <MenuItem value={UserRole.TEACHER}>
                      {getRoleLabel(UserRole.TEACHER)}
                    </MenuItem>
                    <MenuItem value={UserRole.ROP}>РОП</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              label={isEditing ? "Новый пароль" : "Пароль"}
              type="password"
              autoComplete="new-password"
              fullWidth
              required={!isEditing}
              size="small"
              error={Boolean(errors.password)}
              helperText={
                errors.password?.message ??
                (isEditing ? "Оставьте пустым, чтобы не менять" : undefined)
              }
              {...register("password")}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Сохранить
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
