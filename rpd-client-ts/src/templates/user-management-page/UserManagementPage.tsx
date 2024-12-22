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
    TableRow
} from '@mui/material';
import useAuth from '../../store/useAuth';
import { axiosBase } from '../../fetchers/baseURL';
import showSuccessMessage from '../../utils/showSuccessMessage';
import showErrorMessage from '../../utils/showErrorMessage';
import Loader from '../../helperComponents/Loader';

interface User {
    id: number;
    name: string;
    role: number;
    fullname: {
        name: string;
        surname: string;
        patronymic: string;
    }
}

interface NewUser {
    username: string;
    password: string;
    role: number;
    name: string;
    surname: string;
    patronymic: string;
}

const UserManagementPage: FC = () => {
    const [users, setUsers] = useState<User[]>();
    const [open, setOpen] = useState(false);
    const userRole = useAuth.getState().userRole;
    
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
            case 1: return 'Администратор';
            case 2: return 'Преподаватель';
            case 3: return 'РОП';
            default: return 'Неизвестно';
        }
    };

    if (!users) return <Loader />;

    return (
        <Box sx={{ p: 3, maxWidth: '70%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <h2>Управление пользователями</h2>
                {userRole !== 'teacher' && (
                    <Button variant="contained" onClick={handleOpen}>
                        Добавить пользователя
                    </Button>
                )}
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Логин</TableCell>
                            <TableCell>ФИО</TableCell>
                            <TableCell>Роль</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>
                                    {`${user.fullname.surname} ${user.fullname.name} ${user.fullname.patronymic}`}
                                </TableCell>
                                <TableCell>{getRoleName(user.role)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

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
        </Box>
    );
};

export default UserManagementPage;