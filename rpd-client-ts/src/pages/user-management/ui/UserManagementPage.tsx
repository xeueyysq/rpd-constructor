import { Alert, Box, Button, MenuItem } from "@mui/material";
import { getRoleLabel } from "@entities/auth";
import { useSetUsersActive, useUsers, type User } from "@entities/user";
import {
  formatFullName,
  showErrorMessage,
  showSuccessMessage,
} from "@shared/lib";
import { ConfirmActionDialog, Loader, PageTitle } from "@shared/ui";
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  useMaterialReactTable,
} from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { useMemo, useState } from "react";
import { UserFormDialog } from "./UserFormDialog";

export function UserManagementPage() {
  const { data: users = [], isPending, isError } = useUsers();
  const setUsersActive = useSetUsersActive();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id)),
    [rowSelection]
  );

  const columns = useMemo<MRT_ColumnDef<User>[]>(
    () => [
      { accessorKey: "name", header: "Логин" },
      {
        id: "fullname",
        header: "ФИО",
        accessorFn: (row) => formatFullName(row.fullname),
      },
      {
        id: "role",
        header: "Роль",
        accessorFn: (row) => getRoleLabel(row.role),
      },
      {
        id: "status",
        header: "Статус",
        accessorFn: (row) => (row.is_active ? "Активен" : "Деактивирован"),
      },
    ],
    []
  );

  const deactivateUsers = async () => {
    if (selectedIds.length === 0) return;
    try {
      await setUsersActive.mutateAsync({ ids: selectedIds, isActive: false });
      showSuccessMessage("Пользователи деактивированы");
      setRowSelection({});
      setConfirmOpen(false);
    } catch {
      showErrorMessage("Не удалось деактивировать пользователей");
    }
  };

  const activateUser = async (id: number) => {
    try {
      await setUsersActive.mutateAsync({ ids: [id], isActive: true });
      showSuccessMessage("Пользователь активирован");
    } catch {
      showErrorMessage("Не удалось активировать пользователя");
    }
  };

  const table = useMaterialReactTable<User>({
    columns,
    data: users,
    localization: MRT_Localization_RU,
    enableRowSelection: (row) => row.original.is_active,
    enableRowActions: true,
    onRowSelectionChange: setRowSelection,
    layoutMode: "grid",
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    muiTableProps: { size: "small", className: "table" },
    muiTableBodyCellProps: { sx: { py: 0.5 } },
    positionToolbarAlertBanner: "none",
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: "flex", gap: 2, pl: 2, alignItems: "center" }}>
        <Button
          variant="contained"
          onClick={() => {
            setEditingUser(null);
            setFormOpen(true);
          }}
        >
          Добавить пользователя
        </Button>
        <Button
          color="error"
          variant="outlined"
          disabled={selectedIds.length === 0 || setUsersActive.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Деактивировать ({selectedIds.length})
        </Button>
      </Box>
    ),
    renderRowActionMenuItems: ({ row, closeMenu }) => [
      <MenuItem
        key="edit"
        onClick={() => {
          closeMenu();
          setEditingUser(row.original);
          setFormOpen(true);
        }}
      >
        Редактировать
      </MenuItem>,
      ...(!row.original.is_active
        ? [
            <MenuItem
              key="activate"
              onClick={() => {
                closeMenu();
                void activateUser(row.original.id);
              }}
            >
              Активировать
            </MenuItem>,
          ]
        : []),
    ],
  });

  if (isPending) return <Loader />;

  return (
    <Box>
      <PageTitle title="Управление пользователями" />
      <Box sx={{ pt: 3 }}>
        {isError ? (
          <Alert severity="error">Не удалось загрузить пользователей</Alert>
        ) : (
          <MaterialReactTable table={table} />
        )}
      </Box>
      <ConfirmActionDialog
        open={confirmOpen}
        title="Деактивация пользователей"
        description={`Деактивировать выбранных пользователей (${selectedIds.length})?`}
        confirmText="Деактивировать"
        confirmColor="error"
        onConfirm={() => void deactivateUsers()}
        onClose={() => setConfirmOpen(false)}
      />
      <UserFormDialog
        open={formOpen}
        user={editingUser}
        onClose={() => setFormOpen(false)}
      />
    </Box>
  );
}
