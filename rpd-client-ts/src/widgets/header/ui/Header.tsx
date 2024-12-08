import {FC, useContext, useMemo} from 'react'
import {Box, Container, IconButton} from '@mui/material'
import {useWindowSize} from '@shared/hooks'
import HeaderMenuMobile from './HeaderMenuMobile.tsx'
import HeaderLogo from './HeaderLogo.tsx'
import {AuthContext, useAuth} from "@entities/auth"
import {Logout} from '@mui/icons-material'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import {UserRole} from "@shared/ability"

export const Header: FC = () => {
    const size = useWindowSize()
    const {handleLogOut, isUserLogged} = useContext(AuthContext)
    const userName = useAuth.getState().userName
    const userRole = useAuth.getState().userRole

    const getUserRole = useMemo(() => {
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
                height: "80px"
            }}
        >
            <HeaderLogo/>
            {size.width && size.width > 1090 && isUserLogged &&
                <Box sx={{display: "flex", alignItems: "center"}}>
                    <Box sx={{px: 1}}>
                        <AccountCircleIcon sx={{fontSize: "40px"}}/>
                    </Box>
                    <Box>
                        <Box>{userName}</Box>
                        <Box sx={{fontSize: "12px", fontWeight: 400, color: "#B2B2B2"}}>{getUserRole}</Box>
                    </Box>
                    <Box sx={{px: 1}}>
                        <IconButton onClick={handleLogOut}>
                            <Logout/>
                        </IconButton>
                    </Box>
                </Box>
            }
            {size.width && size.width < 1090 &&
                <HeaderMenuMobile/>
            }
        </Container>
    )
}