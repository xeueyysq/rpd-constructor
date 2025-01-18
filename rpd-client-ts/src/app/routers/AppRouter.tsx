import {lazy, Suspense} from 'react'
import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom'

import {useUserRedirect} from "@entities/auth"
import {Header} from "@widgets/header"
import {Loader} from '@shared/ui/'

const Manager = lazy(() => import('@pages/manager'))
const RPDTemplate = lazy(() => import('@pages/rpd-template'))
const TeacherInterface = lazy(() => import('@pages/teacher-interface'))
const SignIn = lazy(() => import('@pages/sign-in'))
const UserManagement = lazy(() => import('@pages/user-management'))
const RpdComplectsList = lazy(() => import('@widgets/rpd-complects'))

export const AppRouter = () => {
    const {isUserLogged, redirectPath} = useUserRedirect()

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
                            <Route path="/users" element={<UserManagement/>}/>
                            <Route path="/rpd-complects" element={<RpdComplectsList/>}/>
                            <Route path="/view-complect" element={<RpdComplectsList/>}/>
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
    )
}

