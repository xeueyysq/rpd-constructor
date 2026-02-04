import { Box, Button, FormControl, InputLabel, MenuItem, OutlinedInput, Select } from "@mui/material";
import { UserRole } from "@shared/ability";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Loader, PageTitle } from "@shared/ui";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";
import axios from "axios";
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, useEffect, useMemo, useState } from "react";
import type { User } from "../model/types";
import { DialogAddUser } from "./DialogAddUser";

export const UserManagementPage: FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);

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

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((k) => rowSelection[k])
        .map((k) => Number(k)),
    [rowSelection]
  );

  const deleteUsers = async () => {
    try {
      setOpenDeleteConfirm(false);
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
    layoutMode: "grid",
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    muiTableProps: {
      size: "small",
      className: "table",
    },
    muiTableBodyCellProps: {
      sx: {
        py: 0.5,
      },
    },
    positionToolbarAlertBanner: "none",
    renderTopToolbarCustomActions: () => {
      const selectedRowsCount = Object.values(table.getState().rowSelection).length;
      return (
        <Box display={"flex"} gap={2} pl={2} alignItems={"center"}>
          <FormControl disabled={!selectedRowsCount} size="small" sx={{ minWidth: 175 }}>
            <InputLabel size="small">Изменить роль</InputLabel>
            <Select
              label="Изменить роль"
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
          <Button
            disabled={!selectedRowsCount}
            color="error"
            variant="outlined"
            onClick={() => setOpenDeleteConfirm(true)}
          >
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

  if (!users) return <Loader />;

  return (
    <Box>
      <PageTitle title={"Управление пользователями"} />
      <Box pt={3}>
        <MaterialReactTable table={table} />
      </Box>
      <WarningDeleteDialog
        open={openDeleteConfirm}
        setOpen={setOpenDeleteConfirm}
        onAccept={deleteUsers}
        description={"Вы уверены, что хотите удалить выбранных пользователей?"}
      />
      <DialogAddUser open={open} setOpen={setOpen} fetchUsers={fetchUsers} />
    </Box>
  );
};
