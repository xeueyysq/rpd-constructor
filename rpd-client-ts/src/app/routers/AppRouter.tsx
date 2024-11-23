import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom';
import {useContext} from 'react';
import Header from '../../templates/Header.tsx';

import {AuthContext, useAuth} from "@features/auth";
import {Manager} from '../../templates/Manager.tsx';
import {RPDTemplate} from '../../templates/RPDTemplate.tsx';
import {TeacherInterface} from '../../templates/TeacherInterface.tsx';
import {SignIn} from '../../templates/SignIn.tsx';

export const AppRouter = () => {
    const {isUserLogged} = useContext(AuthContext);
    const userRole = useAuth.getState().userRole;

    const userRedirect = () => {
        if (!isUserLogged) return "/sign-in";
        if (userRole === "rop") return "/manager";
        if (userRole === "teacher") return "/teacher-interface";
        if (userRole === "admin") return "/rpd-template";

        return "/sign-in";
    }

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
                        element={<Navigate to={userRedirect()}/>}
                    />
                </Routes>
            </Router>
        </>
    )
}
