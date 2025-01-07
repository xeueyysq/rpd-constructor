import Selectors from "./manager-template-page/Selectors";
import TemplateConstructor from "./manager-template-page/TemplateConstructor";
import { Container, Box, Button, Grid } from '@mui/material';
import { FC, useState } from "react";
import ChangeRpdTemplate from "./manager-template-page/steps/ChangeRpdTemplate";
import CreateRpdTemplateFromYear from "./manager-template-page/steps/CreateRpdTemplateFromYear";
import CreateRpdTemplateFrom1CExchange from "./manager-template-page/steps/CreateRpdTemplateFrom1CExchange";
import useAuth from "../store/useAuth";
import { useNavigate } from "react-router-dom";
import ListAltIcon from '@mui/icons-material/ListAlt';

export const Manager: FC = () => {
    const [choise, setChoise] = useState<string>("selectData");
    const userRole = useAuth.getState().userRole;
    const navigate = useNavigate();

    return (
        <Container
            maxWidth="xl"
            sx={{
                display: 'flex',
                justifyContent: 'space-between'
            }}
        >
            <Box
                my={4}
                p={2}
                ml={2}
                sx={{
                    backgroundColor: '#fefefe',
                    width: "100%"
                }}
            >
                <Box component='h2' sx={{ py: 1 }}>Подготовка комплекта РПД функционал РОП</Box>
                {userRole === 'rop' && (
                    <Grid container spacing={2} sx={{ mb: 4, pt: 1 }}>
                        <Grid item>
                            <Button
                                variant="contained"
                                startIcon={<ListAltIcon />}
                                onClick={() => navigate('/rpd-complects')}
                                sx={{ 
                                    height: '30px',
                                    fontSize: '16px',
                                    textTransform: 'none'
                                }}
                            >
                                Просмотр комплектов РПД
                            </Button>
                        </Grid>
                    </Grid>
                )}
                {choise === "selectData" && (
                    <Selectors setChoise={setChoise}/>
                )}
                {choise === "workingType" && (
                    <TemplateConstructor setChoise={setChoise} />
                )}
                {choise === "changeTemplate" && (
                    <ChangeRpdTemplate setChoise={setChoise} />
                )}
                {choise === "createTemplateFromCurrentYear" && (
                    <CreateRpdTemplateFromYear setChoise={setChoise} />
                )}
                {choise === "createTemplateFromExchange" && (
                    <CreateRpdTemplateFrom1CExchange setChoise={setChoise} />
                )}
            </Box>
        </Container>
    );
}