import { Container, Box } from '@mui/material';
import { useState } from 'react';
import RpdList from './RpdList/RpdList';
import RpdCoverPage from './rpd-template-page/RpdCoverPage';
import { FC } from 'react';
import { RpdListItems } from '../constants/rpdTemplateItems';
import AimsPage from './teacher-interface-page/pages/AimsPage';
import ApprovalPage from './teacher-interface-page/pages/ApprovalPage';
import DisciplineContentPage from './teacher-interface-page/pages/DisciplineContentPage';
import DisciplineEvaluationsFunds from './teacher-interface-page/pages/DisciplineEvaluationsFunds';
import DisciplinePlace from './teacher-interface-page/pages/DisciplinePlace';
import DisciplineSupportPage from './teacher-interface-page/pages/DisciplineSupportPage';
import PlannedResultsPage from './teacher-interface-page/pages/PlannedResultsPage';
import ResourceSupportPage from './teacher-interface-page/pages/ResourceSupportPage';
import ScopeDisciplinePage from './teacher-interface-page/pages/ScopeDisciplinePage';
import useAuth from '../store/useAuth';
import Can from '../ability/Can';

export const RPDTemplate: FC = () => {
    const [choise, setChoise] = useState<string>("coverPage");
    const userRole = useAuth.getState().userRole;

    const renderContent = () => {
        switch (choise) {
            case "coverPage":
                return <RpdCoverPage />;
            case "approvalPage":
                return <ApprovalPage />;
            case "aimsPage":
                return <AimsPage />;
            case "disciplinePlace":
                return <DisciplinePlace />;
            case "disciplinePlannedResults":
                return <PlannedResultsPage />;
            case "disciplineScope":
                return <ScopeDisciplinePage />;
            case "disciplineContent":
                return <DisciplineContentPage />;
            case "disciplineSupport":
                return <DisciplineSupportPage />;
            case "disciplineEvaluationsFunds":
                return <DisciplineEvaluationsFunds />;
            case "resourceSupport":
                return <ResourceSupportPage />;
            default:
                return <RpdCoverPage />;
        }
    };

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
                    <Can I="get" a="rpd_template">
                        <RpdList RpdListItems={RpdListItems} setChoise={setChoise}/>
                    </Can>
                </Box>
            </Box>
            <Box
                my={4}
                p={2}
                ml={2}
                sx={{ backgroundColor: '#fefefe', width: "100%"}}
            >
                <Can I="get" a="rpd_template">
                    {renderContent()}
                </Can>
            </Box>
        </Container>
    );
}