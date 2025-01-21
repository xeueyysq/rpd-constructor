import {FC, useContext, useMemo} from 'react'
import {Box, Container, IconButton} from '@mui/material'
import {useWindowSize} from '@shared/hooks'
import HeaderMenuMobile from './HeaderMenuMobile.tsx'
import HeaderLogo from './HeaderLogo.tsx'
import {AuthContext, useAuth} from "@entities/auth"
import {Logout} from '@mui/icons-material'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import {UserRole} from "@shared/ability"
import {useNavigate} from 'react-router-dom'

export const Header: FC = () => {
    const size = useWindowSize()
    const {handleLogOut, isUserLogged} = useContext(AuthContext)
    const userName = useAuth.getState().userName
    const userRole = useAuth.getState().userRole
    const navigate = useNavigate()

    const userRoleLocale = useMemo(() => {
        switch (userRole) {
            case UserRole.ADMIN:
                return "Администратор"
            case UserRole.TEACHER:
                return "Преподаватель"
            case UserRole.ROP:
                return "Руководитель образовательной программы"
            default:
                return "Неавторизованный пользователь"
        }
    }, [userRole])

    return (
        <Container
            maxWidth="xl"
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#fefefe',
                height: "80px",
                minWidth: '100%'
            }}
        >
            <HeaderLogo/>
            {size.width && size.width > 1090 && isUserLogged &&
                <Box sx={{display: "flex", alignItems: "center"}}>
                    {userRole !== UserRole.TEACHER &&
                        <Box>
                            <IconButton onClick={() => navigate('/users')}>
                                <PersonAddIcon/>
                            </IconButton>
                        </Box>
                    }
                    <Box sx={{px: 1}}>
                        <IconButton onClick={handleLogOut}>
                            <Logout/>
                        </IconButton>
                    </Box>
                    <Box>
                        <Box>{userName}</Box>
                        <Box sx={{fontSize: "12px", fontWeight: 400, color: "#B2B2B2", textAlign: 'right'}}>{userRoleLocale}</Box>
                    </Box>
                    <Box sx={{px: 1}}>
                        <AccountCircleIcon sx={{fontSize: "50px"}}/>
                    </Box>
                </Box>
            }
            {size.width && size.width < 1090 &&
                <HeaderMenuMobile/>
            }
        </Container>
    )
}