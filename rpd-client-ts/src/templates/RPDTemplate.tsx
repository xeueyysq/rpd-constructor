import {Box, Container} from '@mui/material';
import {FC, useState} from 'react';
import RpdList from './RpdList/RpdList';
import RpdCoverPage from './rpd-template-page/RpdCoverPage';
import {RpdListItems} from '../constants/rpdTemplateItems';

const RPDTemplate: FC = () => {
    const [choise, setChoise] = useState<string>("coverPage");

    return (
        <Container
            maxWidth="xl"
            sx={{
                display: 'flex',
                justifyContent: 'space-between'
            }}
        >
            <Box
                minWidth={400}
                maxWidth={400}
                my={4}
                mr={2}
            >
                <Box
                    height={550}
                    py={1}
                    sx={{
                        position: "sticky",
                        top: "20px",
                        backgroundColor: '#fefefe'
                    }}
                >
                    <RpdList RpdListItems={RpdListItems} setChoise={setChoise}/>
                </Box>
            </Box>
            <Box
                my={4}
                p={2}
                ml={2}
                sx={{backgroundColor: '#fefefe', width: "100%"}}
            >
                {choise === "coverPage" && (
                    <RpdCoverPage/>
                )}
            </Box>
        </Container>
    );
}

export default RPDTemplate;