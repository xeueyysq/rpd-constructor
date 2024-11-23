import {FC, MouseEvent, useContext, useState} from 'react';
import {Box, Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography} from '@mui/material';
import {AccountCircle, Logout} from '@mui/icons-material';
import MenuIcon from '@mui/icons-material/Menu';
import {useAuth} from "@features/auth";
import {AuthContext} from "../../app/providers/AuthProvider.tsx";

const HeaderMenuMobile: FC = () => {
    const {handleLogOut, isUserLogged} = useContext(AuthContext);
    const userName = useAuth.getState().userName;

    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            {isUserLogged &&
                <Box>
                    <Button
                        id="basic-button"
                        aria-controls={open ? 'basic-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        onClick={handleClick}
                        endIcon={
                            <MenuIcon sx={{color: "black"}}/>
                        }
                        sx={{
                            color: "black",
                            my: "10px"
                        }}
                    >
                        Меню
                    </Button>
                    <Menu
                        id="basic-menu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        MenuListProps={{
                            'aria-labelledby': 'basic-button',
                        }}
                    >
                        <Divider/>
                        <MenuItem>
                            <ListItemIcon>
                                <AccountCircle/>
                            </ListItemIcon>
                            <ListItemText>
                                <Typography variant="button" display="block" gutterBottom color="grey" m="0">
                                    {userName}
                                </Typography>
                            </ListItemText>
                        </MenuItem>
                        <MenuItem>
                            <ListItemIcon>
                                <Logout/>
                            </ListItemIcon>
                            <ListItemText>
                                <Button onClick={handleLogOut} size="small" sx={{color: "grey"}}>
                                    Выйти
                                </Button>
                            </ListItemText>
                        </MenuItem>
                    </Menu>
                </Box>
            }
        </>
    );
}

export default HeaderMenuMobile;