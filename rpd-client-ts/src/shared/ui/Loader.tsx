import {Box, CircularProgress} from '@mui/material'

export function Loader() {
    return (
        <Box sx={{p: 1, display: 'flex', alignItems: 'center'}}>
            <CircularProgress color="inherit" size="1rem"/>
            <Box sx={{px: 1}}>
                Загрузка...
            </Box>
        </Box>
    )
}