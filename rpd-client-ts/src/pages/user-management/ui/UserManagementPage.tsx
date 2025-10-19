import { useAuth } from "@entities/auth";
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
  OutlinedInput,
  Select,
  SelectChangeEvent,
  TextField,
} from "@mui/material";
import { UserRole } from "@shared/ability";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Loader, PageTitle } from "@shared/ui";
import axios from "axios";
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { NewUser, User } from "../model/types";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";

export const UserManagementPage: FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);

  const [newUser, setNewUser] = useState<NewUser>({
    username: "",
    password: "",
    role: UserRole.TEACHER,
    name: "",
    surname: "",
    patronymic: "",
  });

  const fetchUsers = async () => {
    try {
      const response = await axiosBase.get("get-users");
      setUsers(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpen = () => setOpen(true);
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

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Администратор";
      case UserRole.TEACHER:
        return "Преподаватель";
      case UserRole.ROP:
        return "Руководитель образовательной программы";
      default:
        return "Неизвестно";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") e.preventDefault();
  };

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((k) => rowSelection[k])
        .map((k) => Number(k)),
    [rowSelection]
  );

  const deleteUsers = async () => {
    try {
      for (const userId of selectedIds) {
        await axiosBase.delete(`delete-user/${userId}`);
      }
      showSuccessMessage("Пользователи успешно удалены");
      setRowSelection({});
      fetchUsers();
    } catch (error) {
      showErrorMessage("Ошибка при удалении пользователей");
      console.error(error);
    }
  };

  const updateUserRole = async (userId: number, newRole: UserRole) => {
    try {
      const user = users.find((u) => u.id === userId);

      if (user && user.role === UserRole.ADMIN) {
        showErrorMessage("Нельзя изменить роль администратора");
        return;
      }

      await axiosBase.post("update-user-role", {
        userId,
        newRole,
      });

      fetchUsers();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            method: error.config?.method,
          },
        });
      }
      showErrorMessage("Ошибка при обновлении роли пользователя");
    }
  };

  const data = useMemo(() => users, [users]);

  const columns = useMemo<MRT_ColumnDef<User>[]>(
    () => [
      { accessorKey: "name", header: "Логин" },
      {
        accessorKey: "fullname",
        header: "ФИО",
        Cell: ({ row }) =>
          `${row.original.fullname.surname} ${row.original.fullname.name} ${row.original.fullname.patronymic}`,
        enableSorting: false,
      },
      {
        accessorKey: "role",
        header: "Роль",
        Cell: ({ row }) => getRoleName(row.original.role),
      },
    ],
    []
  );

  const table = useMaterialReactTable<User>({
    columns,
    data,
    localization: MRT_Localization_RU,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    muiTableProps: {
      size: "small",
      sx: { px: 2 },
    },
    muiTableBodyCellProps: ({ column }) => ({
      sx: column.id === "mrt-row-select" ? { paddingRight: 0, paddingLeft: 0 } : { py: 0.5, px: 0.5 },
    }),
    muiTableHeadCellProps: ({ column }) => ({
      sx: column.id === "mrt-row-select" ? { paddingRight: 0, paddingLeft: 0 } : { py: 0.5, px: 0.5 },
    }),
    renderToolbarAlertBannerContent: () => {
      if (selectedIds.length)
        return (
          <Box display={"flex"} gap={2} pl={2}>
            <FormControl size="small" sx={{ minWidth: 175 }}>
              <InputLabel
                size="small"
                sx={{
                  top: "50%",
                  transform: "translate(14px, -50%)",
                  "&.MuiInputLabel-shrink": {
                    top: 0,
                    transform: "translate(14px, -9px) scale(0.75)",
                  },
                }}
              >
                Изменить роль
              </InputLabel>
              <Select
                label="Изменить роль"
                sx={{ "& .MuiSelect-select": { py: 0.5 } }}
                input={<OutlinedInput label="Изменить роль" size="small" />}
                defaultValue=""
                onChange={(e) => {
                  selectedIds.forEach((userId) => {
                    updateUserRole(userId, Number(e.target.value) as UserRole);
                  });
                  showSuccessMessage("Роль пользователя успешно обновлена");
                  setRowSelection({});
                }}
              >
                <MenuItem value={UserRole.TEACHER}>Преподаватель</MenuItem>
                <MenuItem value={UserRole.ROP}>РОП</MenuItem>
              </Select>
            </FormControl>
            <Button color="error" onClick={() => setOpenDeleteConfirm(true)}>
              Удалить
            </Button>
          </Box>
        );
    },
    renderToolbarInternalActions: () => (
      <Box pr={1}>
        <Button variant="contained" onClick={handleOpen}>
          Добавить пользователя
        </Button>
      </Box>
    ),
  });

  const handleRoleChange = (event: SelectChangeEvent<UserRole>) => {
    setNewUser({ ...newUser, role: event.target.value as UserRole });
  };

  if (!users) return <Loader />;

  return (
    <Box>
      <PageTitle title={"Управление пользователями"} />
      <Box py={2}>
        <MaterialReactTable table={table} />
      </Box>
      <WarningDeleteDialog
        open={openDeleteConfirm}
        setOpen={setOpenDeleteConfirm}
        onAccept={deleteUsers}
        description={"Вы уверены, что хотите удалить выбранных пользователей?"}
      />
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Добавить нового пользователя</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              size="small"
              label="Логин"
              value={newUser.username}
              onChange={handleChange("username")}
              onKeyDown={handleKeyDown}
            />
            <TextField
              size="small"
              label="Пароль"
              type="password"
              value={newUser.password}
              onChange={handleChange("password")}
              onKeyDown={handleKeyDown}
            />
            <FormControl>
              <InputLabel>Роль</InputLabel>
              <Select<UserRole> size="small" value={newUser.role} label="Роль" onChange={handleRoleChange}>
                <MenuItem value={UserRole.ROP}>РОП</MenuItem>
                <MenuItem value={UserRole.TEACHER}>Преподаватель</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Фамилия"
              value={newUser.surname}
              onChange={handleChange("surname")}
              onKeyDown={handleKeyDown}
            />
            <TextField
              size="small"
              label="Имя"
              value={newUser.name}
              onChange={handleChange("name")}
              onKeyDown={handleKeyDown}
            />
            <TextField
              size="small"
              label="Отчество"
              value={newUser.patronymic}
              onChange={handleChange("patronymic")}
              onKeyDown={handleKeyDown}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Отмена</Button>
          <Button onClick={handleSubmit} variant="contained">
            Добавить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
