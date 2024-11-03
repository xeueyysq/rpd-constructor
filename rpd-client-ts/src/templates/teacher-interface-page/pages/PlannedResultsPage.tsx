import useStore from "../../../store/useStore";
import axios from "axios";
import { FC, useState } from 'react';
import EditableCell from "../changeable-elements/EditableCell";
import { Box, Button, ButtonGroup, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper } from '@mui/material';
import Loader from "../../../helperComponents/Loader";
import { PlannedResultsData } from "../../../types/DisciplineContentPageTypes";
import showSuccessMessage from "../../../utils/showSuccessMessage";
import showErrorMessage from "../../../utils/showErrorMessage";
import { axiosBase } from "../../../fetchers/baseURL";
import Can from "../../../ability/Can";
import Papa from 'papaparse';

const PlannedResultsPage: FC = () => {
    const initialData = useStore.getState().jsonData.competencies as PlannedResultsData | undefined;
    const initialDataLength = initialData ? Object.keys(initialData).length : 0;

    const { updateJsonData } = useStore();
    const [data, setData] = useState<PlannedResultsData | undefined>(initialData);
    const [nextId, setNextId] = useState<number>(initialDataLength);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            complete: (results) => {
                const parsedData = results.data.slice(1);
                const formattedData = parsedData.reduce((acc: PlannedResultsData, row: any, index: number, nextRow: any) => {
                    nextRow = parsedData[index + 1]
                    const competence = row[0] ? `${row[0]} ${row[3]}` : '';
                    const indicator = nextRow && nextRow[1] ? `${nextRow[1]} ${nextRow[3]}` : '';
                    const results = '';

                    if (competence || indicator || results) {
                        acc[index] = { competence, indicator, results };
                    }
                    return acc;
                }, {});
                setData(formattedData);
                setNextId(Object.keys(formattedData).length);
            },
            encoding: 'cp1251',
            delimiter: ';',
        });
    };

    const handleAddRow = () => {
        setNextId(nextId + 1);
        const newData = { ...data, [nextId]: { competence: '', indicator: '', results: '' } };
        setData(newData);
    };

    const handleValueChange = (id: number, key: string, value: string) => {
        if (!data) return;

        const newData = {
            ...data,
            [id]: {
                ...data[id],
                [key]: value,
            },
        };
        setData(newData);
    };

    const saveData = async () => {
        if(!data) return;

        const id = useStore.getState().jsonData.id;
    
        const filteredData = Object.entries(data).reduce((acc: PlannedResultsData, [key, value]) => {
            if (value.competence || value.indicator || value.results) {
                acc[key] = value;
            }
            return acc;
        }, {});
    
        try {
            await axiosBase.put(`update-json-value/${id}`, {
                fieldToUpdate: "competencies",
                value: filteredData
            });
    
            updateJsonData("competencies", filteredData);
            setData(filteredData);
            showSuccessMessage("Данные успешно сохранены");
        } catch (error) {
            showErrorMessage("Ошибка сохранения данных");
            if (axios.isAxiosError(error)) {
                console.error('Ошибка Axios:', error.response?.data);
                console.error('Статус ошибки:', error.response?.status);
                console.error('Заголовки ошибки:', error.response?.headers);
            } else {
                console.error('Неизвестная ошибка:', error);
            }
        }
    };
    

    if (!data) return <Loader />

    return (
        <Box>
            <Box component='h2'>Планируемые результаты обучения по дисциплине (модулю)</Box>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
            <TableContainer component={Paper} sx={{ my: 2 }}>
                <Table sx={{ minWidth: 650 }} aria-label="simple table" size="small" className="table">
                    <TableHead>
                        <TableRow>
                            <TableCell align="center">
                                Формируемые компетенции(код и наименование)
                            </TableCell>
                            <TableCell align="center">
                                Индикаторы достижения компетенций (код и формулировка)
                            </TableCell>
                            <TableCell align="center">
                                Планируемые результаты обучения по дисциплине (модулю)
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.keys(data).map((key) => (
                            <TableRow key={key}>
                                <TableCell>
                                    <EditableCell
                                        value={data[key].competence}
                                        onValueChange={() => {}}
                                        readOnly
                                    />
                                </TableCell>
                                <TableCell>
                                    <EditableCell
                                        value={data[key].indicator}
                                        onValueChange={() => {}}
                                        readOnly
                                    />
                                </TableCell>
                                <TableCell>
                                    <Can I="edit" a="competencies">
                                        <EditableCell
                                            value={data[key].results}
                                            onValueChange={(value: string) => handleValueChange(Number(key), 'results', value)}
                                        />
                                    </Can>
                                    <Can not I="edit" a="competencies">
                                        <EditableCell
                                            value={data[key].results}
                                            onValueChange={() => {}}
                                            readOnly
                                        />
                                    </Can>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <ButtonGroup variant="outlined" aria-label="Basic button group" size="small">
                <Button onClick={handleAddRow}>Добавить строку</Button>
                <Button onClick={saveData}>Сохранить изменения</Button>
            </ButtonGroup>
        </Box>
    );
}

export default PlannedResultsPage;
