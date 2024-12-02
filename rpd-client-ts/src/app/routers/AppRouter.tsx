import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom';
import Header from '../../templates/Header.tsx';

import {useUserRedirect} from "@features/auth";
import {Manager} from '../../templates/Manager.tsx';
import {RPDTemplate} from '../../templates/RPDTemplate.tsx';
import {TeacherInterface} from '../../templates/TeacherInterface.tsx';
import {SignIn} from "@pages/signIn";

export const AppRouter = () => {
    const {isUserLogged, redirectPath} = useUserRedirect();

    return (
        <>

            <Router>
                <Header/>
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
            </Router>
        </>
    )
}
