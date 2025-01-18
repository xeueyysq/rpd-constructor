import { FC, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Box, Container, Grid, Button } from '@mui/material'
import ListAltIcon from '@mui/icons-material/ListAlt'
import { Selectors } from "@features/select-template-data"
import { TemplateConstructor } from "@features/create-rpd-template"
import { ChangeRpdTemplate } from "@features/change-rpd-template"
import { CreateRpdTemplateFromYear } from "@features/create-rpd-template-from-year"
import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange"

export const Manager: FC = () => {
    const [choise, setChoise] = useState<string>("selectData")
    const navigate = useNavigate()

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
                <Box component='h2' sx={{py: 1}}>Подготовка комплекта РПД функционал РОП</Box>
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
                {choise === "selectData" && (
                    <Selectors setChoise={setChoise}/>
                )}
                {choise === "workingType" && (
                    <TemplateConstructor setChoise={setChoise}/>
                )}
                {choise === "changeTemplate" && (
                    <ChangeRpdTemplate setChoise={setChoise}/>
                )}
                {choise === "createTemplateFromCurrentYear" && (
                    <CreateRpdTemplateFromYear setChoise={setChoise}/>
                )}
                {choise === "createTemplateFromExchange" && (
                    <CreateRpdTemplateFrom1CExchange setChoise={setChoise}/>
                )}
            </Box>
        </Container>
    )
}
