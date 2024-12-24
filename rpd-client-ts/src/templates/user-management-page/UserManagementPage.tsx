import { FC, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    TablePagination,
    Checkbox,
    Toolbar,
    Typography,
    Container,
} from '@mui/material';
import useAuth from '../../store/useAuth';
import { axiosBase } from '../../fetchers/baseURL';
import showSuccessMessage from '../../utils/showSuccessMessage';
import showErrorMessage from '../../utils/showErrorMessage';
import Loader from '../../helperComponents/Loader';
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    role: number;
    fullname: {
        name: string;
        surname: string;
        patronymic: string;
    };
}

interface NewUser {
    username: string;
    password: string;
    role: number;
    name: string;
    surname: string;
    patronymic: string;
}

type Order = 'asc' | 'desc';

const UserManagementPage: FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<keyof User>('name');
    const [selected, setSelected] = useState<number[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [open, setOpen] = useState(false);
    const userRole = useAuth.getState().userRole;
    const navigate = useNavigate();

    const [newUser, setNewUser] = useState<NewUser>({
        username: '',
        password: '',
        role: 2,
        name: '',
        surname: '',
        patronymic: ''
    });

    const fetchUsers = async () => {
        try {
            const response = await axiosBase.get('get-users');
            setUsers(response.data);
        } catch (error) {
            showErrorMessage('Ошибка при получении данных');
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
            username: '',
            password: '',
            role: 2,
            name: '',
            surname: '',
            patronymic: ''
        });
    };

    const handleChange = (prop: keyof NewUser) => (event: any) => {
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
                        patronymic: newUser.patronymic
                    }
                }
            };

            await axiosBase.post('add-user', userData);
            showSuccessMessage('Пользователь успешно добавлен');
            handleClose();
            fetchUsers();
        } catch (error) {
            showErrorMessage('Ошибка при добавлении пользователя');
            console.error(error);
        }
    };

    const getRoleName = (role: number) => {
        switch (role) {
            case 1:
                return 'Администратор';
            case 2:
                return 'Преподаватель';
            case 3:
                return 'РОП';
            default:
                return 'Неизвестно';
        }
    };

    const handleRequestSort = (property: keyof User) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            const newSelected = users.map((user) => user.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    };

    const handleClick = (id: number) => {
        const selectedIndex = selected.indexOf(id);
        let newSelected: number[] = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1)
            );
        }

        setSelected(newSelected);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const isSelected = (id: number) => selected.indexOf(id) !== -1;

    const deleteUsers = async () => {
        try {
            for (const userId of selected) {
                await axiosBase.delete(`delete-user/${userId}`);
            }
            showSuccessMessage('Пользователи успешно удалены');
            setSelected([]);
            fetchUsers();
        } catch (error) {
            showErrorMessage('Ошибка при удалении пользователей');
            console.error(error);
        }
    };

    const updateUserRole = async (userId: number, newRole: number) => {
        try {
            const user = users.find(u => u.id === userId);
            console.log('Attempting to update user role:', { userId, newRole, user });
            console.log('Server URL:', axiosBase.defaults.baseURL);
            
            if (user && user.role === 1) {
                showErrorMessage('Нельзя изменить роль администратора');
                return;
            }
            
            console.log('Sending POST request to update user role');
            const response = await axiosBase.post('update-user-role', {
                userId,
                newRole
            });
            console.log('Response from server:', response);
            
            showSuccessMessage('Роль пользователя успешно обновлена');
            fetchUsers();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Axios error:', {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                    config: {
                        url: error.config?.url,
                        baseURL: error.config?.baseURL,
                        method: error.config?.method
                    }
                });
            }
            showErrorMessage('Ошибка при обновлении роли пользователя');
        }
    };

    const sortedUsers = users
        .filter(user => userRole === 'rop' ? user.role === 2 : true)
        .slice()
        .sort((a, b) => {
            const comparator = order === 'asc' ? 1 : -1;
            return a[orderBy] < b[orderBy] ? -comparator : comparator;
        });

    const paginatedUsers = sortedUsers.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    if (!users) return <Loader />;

    return (
        <Container sx={{ p: 3}}>
            <Toolbar>
                <Typography sx={{ flex: '1 1 100%' }} variant="h6" id="tableTitle">
                    Управление пользователями
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {selected.length > 0 && (
                        <>
                            {userRole !== 'rop' && (
                                <FormControl size='small' sx={{ minWidth: 200}}>
                                    <InputLabel>Изменить роль</InputLabel>
                                    <Select
                                        label="Изменить роль"
                                        defaultValue=""
                                        onChange={(e) => {
                                            selected.forEach(userId => {
                                                updateUserRole(userId, Number(e.target.value));
                                            });
                                            setSelected([]);
                                        }}
                                    >
                                        <MenuItem value={2}>Преподаватель</MenuItem>
                                        <MenuItem value={3}>РОП</MenuItem>
                                    </Select>
                                </FormControl>
                            )}
                            {userRole === 'admin' && (
                                <Button
                                    color="error"
                                    variant="contained"
                                    onClick={deleteUsers}
                                    sx={{fontSize: 12}}
                                >
                                    Удалить
                                </Button>
                            )}
                        </>
                    )}
                    {userRole !== 'teacher' && (
                        <Button sx={{fontSize: 12, width: 260}} variant="contained" onClick={handleOpen}>
                            Добавить пользователя
                        </Button>
                    )}
                </Box>
            </Toolbar>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    indeterminate={
                                        selected.length > 0 && selected.length < users.length
                                    }
                                    checked={users.length > 0 && selected.length === users.length}
                                    onChange={handleSelectAllClick}
                                />
                            </TableCell>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'name'}
                                    direction={orderBy === 'name' ? order : 'asc'}
                                    onClick={() => handleRequestSort('name')}
                                >
                                    Логин
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'fullname.surname'}
                                    direction={orderBy === 'fullname.surname' ? order : 'asc'}
                                    onClick={() => handleRequestSort('fullname.surname')}
                                >
                                    ФИО
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel
                                    active={orderBy === 'role'}
                                    direction={orderBy === 'role' ? order : 'asc'}
                                    onClick={() => handleRequestSort('role')}
                                >
                                    Роль
                                </TableSortLabel>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedUsers.map((user) => {
                            const isItemSelected = isSelected(user.id);
                            return (
                                <TableRow
                                    key={user.id}
                                    onClick={() => handleClick(user.id)}
                                    role="checkbox"
                                    aria-checked={isItemSelected}
                                    selected={isItemSelected}
                                    sx={{
                                        cursor: 'pointer',
                                        '&.Mui-selected': {
                                            backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                        },
                                        '&.Mui-selected:hover': {
                                            backgroundColor: 'rgba(25, 118, 210, 0.12)',
                                        },
                                    }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={isItemSelected}
                                            onChange={() => handleClick(user.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{user.name}</TableCell>
                                    <TableCell>
                                        {`${user.fullname.surname} ${user.fullname.name} ${user.fullname.patronymic}`}
                                    </TableCell>
                                    <TableCell>{getRoleName(user.role)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <Grid2 alignItems={'center'} display={'flex'} justifyContent={'space-between'}>
                <Button variant='outlined' sx={{height: 30}} onClick={() => navigate(-1)}>
                    Назад
                </Button>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={users.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Grid2>
            

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>Добавить нового пользователя</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Логин"
                            value={newUser.username}
                            onChange={handleChange('username')}
                        />
                        <TextField
                            label="Пароль"
                            type="password"
                            value={newUser.password}
                            onChange={handleChange('password')}
                        />
                        <FormControl>
                            <InputLabel>Роль</InputLabel>
                            <Select
                                value={newUser.role}
                                label="Роль"
                                onChange={handleChange('role')}
                            >
                                {userRole === 'admin' && (
                                    <MenuItem value={3}>РОП</MenuItem>
                                )}
                                <MenuItem value={2}>Преподаватель</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label="Фамилия"
                            value={newUser.surname}
                            onChange={handleChange('surname')}
                        />
                        <TextField
                            label="Имя"
                            value={newUser.name}
                            onChange={handleChange('name')}
                        />
                        <TextField
                            label="Отчество"
                            value={newUser.patronymic}
                            onChange={handleChange('patronymic')}
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
        </Container>
    );
};

export default UserManagementPage;
