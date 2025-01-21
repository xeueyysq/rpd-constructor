import { FC, useState } from "react"
import { Box, Container, Button } from '@mui/material'
import ListAltIcon from '@mui/icons-material/ListAlt'
import { Selectors } from "@features/select-template-data"
import { TemplateConstructor } from "@features/create-rpd-template"
import { ChangeRpdTemplate } from "@features/change-rpd-template"
import { CreateRpdTemplateFromYear } from "@features/create-rpd-template-from-year"
import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange"
import RpdComplectsList from "@widgets/rpd-complects"

export const Manager: FC = () => {
    const [choise, setChoise] = useState<string>("selectData")

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
                {choise !== 'viewRpdComplectsList' && (<Button
                    sx={{marginTop: 1, marginBottom: 4}}
                    variant="contained"
                    size="small"
                    startIcon={<ListAltIcon />}
                    onClick={() => setChoise('viewRpdComplectsList')}
                >
                    Просмотр комплектов РПД
                </Button>)}
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
                {choise === "viewRpdComplectsList" && (
                    <RpdComplectsList setChoise={setChoise}/>
                )}
            </Box>
        </Container>
    )
}
