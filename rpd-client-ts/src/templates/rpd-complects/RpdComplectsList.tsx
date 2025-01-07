import { FC, useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Container
} from '@mui/material';
import { axiosBase } from '../../fetchers/baseURL';
import showErrorMessage from '../../utils/showErrorMessage';
import Loader from '../../helperComponents/Loader';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface RpdComplect {
    id: number;
    faculty: string;
    levelEducation: string;
    directionOfStudy: string;
    profile: string;
    formEducation: string;
    year: string;
}

const RpdComplectsList: FC = () => {
    const [complects, setComplects] = useState<RpdComplect[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { setComplectId, setSelectedTemplateData } = useStore();

    useEffect(() => {
        fetchComplects();
    }, []);

    const fetchComplects = async () => {
        try {
            const response = await axiosBase.get('get-rpd-complects');
            setComplects(response.data);
            setLoading(false);
        } catch (error) {
            showErrorMessage('Ошибка при получении данных');
            console.error(error);
            setLoading(false);
        }
    };

    const handleViewComplect = (complect: RpdComplect) => {
        setSelectedTemplateData({
            faculty: complect.faculty,
            levelEducation: complect.levelEducation,
            directionOfStudy: complect.directionOfStudy,
            profile: complect.profile,
            formEducation: complect.formEducation,
            year: complect.year
        });
        setComplectId(complect.id);
        navigate('/view-complect');
    };

    if (loading) return <Loader />;

    return (
        <Container>
            <Box sx={{ my: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Button 
                        variant="outlined" 
                        onClick={() => navigate('/manager')}
                        startIcon={<ArrowBackIcon />}
                        sx={{ mr: 2 }}
                    >
                        Назад
                    </Button>
                    <Box component="h2" sx={{ m: 0 }}>
                        Комплекты РПД
                    </Box>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Институт</TableCell>
                                <TableCell>Уровень образования</TableCell>
                                <TableCell>Направление</TableCell>
                                <TableCell>Профиль</TableCell>
                                <TableCell>Форма обучения</TableCell>
                                <TableCell>Год набора</TableCell>
                                <TableCell align="center">Действия</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {complects.map((complect) => (
                                <TableRow key={complect.id}>
                                    <TableCell>{complect.faculty}</TableCell>
                                    <TableCell>{complect.levelEducation}</TableCell>
                                    <TableCell>{complect.directionOfStudy}</TableCell>
                                    <TableCell>{complect.profile}</TableCell>
                                    <TableCell>{complect.formEducation}</TableCell>
                                    <TableCell>{complect.year}</TableCell>
                                    <TableCell align="center">
                                        <Button 
                                            variant="contained" 
                                            size="small"
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => handleViewComplect(complect)}
                                        >
                                            Просмотр
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Container>
    );
};

export default RpdComplectsList; 