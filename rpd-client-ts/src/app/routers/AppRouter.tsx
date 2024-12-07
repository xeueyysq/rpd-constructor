import {lazy, Suspense} from 'react';
import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom';

import {useUserRedirect} from "@features/auth";
import {Header} from "@widgets/header";
import {Loader} from '@shared/ui/';

const Manager = lazy(() => import('../../templates/Manager.tsx'));
const RPDTemplate = lazy(() => import('@pages/rpdTemplate'));
const TeacherInterface = lazy(() => import('../../templates/TeacherInterface.tsx'));
const SignIn = lazy(() => import('@pages/signIn'));

export const AppRouter = () => {
    const {isUserLogged, redirectPath} = useUserRedirect();

    return (
        <Router>
            <Header/>
            <Suspense fallback={<Loader/>}>
                <Routes>
                    {isUserLogged ? (
                        <>
                            <Route path="/manager" element={<Manager/>}/>
                            <Route path="/rpd-template" element={<RPDTemplate/>}/>
                            <Route path="/teacher-interface" element={<TeacherInterface/>}/>
                        </>
                    ) : (
                        <Route path="/sign-in" element={<SignIn/>}/>
                    )}
                    <Route
                        path="*"
                        element={<Navigate to={redirectPath}/>}
                    />
                </Routes>
            </Suspense>
        </Router>
    );
};

