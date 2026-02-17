import { FormProvider, useForm } from "react-hook-form";
import { FC, MouseEvent, useContext, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItem,
  ListItemIcon,
  OutlinedInput,
  Typography,
  List,
  ListItemText,
  SvgIcon,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { AuthContext } from "@entities/auth";
import { signInSchema } from "../model/signInSchema.ts";
import CheckIcon from "@mui/icons-material/Check";
import Logo from "../../../../public/images/logo_30.svg?react";

export const SignIn: FC = () => {
  const { handleSignIn } = useContext(AuthContext);

  const formMethods = useForm({ resolver: yupResolver(signInSchema) });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = formMethods;

  const [showPassword, setShowPassword] = useState(false);
  const handleClickShowPassword = () =>
    setShowPassword((show: boolean) => !show);
  const handleMouseDownPassword = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <Box display={"flex"} height={"100vh"}>
      <Box
        sx={{ background: "#f1f2f4" }}
        minWidth={"600px"}
        // pt={23}
        p={5}
      >
        <Box display={"flex"} alignItems={"center"} gap={3}>
          <SvgIcon
            component={Logo}
            inheritViewBox
            sx={{ fontSize: "85px", ml: 2.5 }}
          />
          <Typography color="#737781" fontSize={"1.2rem"}>
            Государственный университет Дубна
          </Typography>
        </Box>
        <Box pt={15}>
          <Typography
            ml={2.5}
            fontSize={"30px"}
            width={"500px"}
            fontWeight={"bold"}
            gutterBottom
          >
            Добро пожаловать в конструктор рабочих программ дисциплин
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
              <ListItemText
                primary="Преподаватели"
                slotProps={{
                  primary: {
                    fontSize: "1.25rem",
                  },
                }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
              <ListItemText
                primary="Справочники"
                slotProps={{
                  primary: {
                    fontSize: "1.25rem",
                  },
                }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
              <ListItemText
                primary="Шаблоны рабочих программ"
                slotProps={{
                  primary: {
                    fontSize: "1.25rem",
                  },
                }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
              <ListItemText
                primary="Конструктор рабочих программ"
                slotProps={{
                  primary: {
                    fontSize: "1.25rem",
                  },
                }}
              />
            </ListItem>
          </List>
        </Box>
      </Box>
      <FormProvider {...formMethods}>
        <Box
          width={"100%"}
          alignContent={"center"}
          alignItems={"center"}
          pb={5}
        >
          <Box
            sx={{
              borderRadius: 5,
              maxWidth: 500,
              margin: "20px auto",
              backgroundColor: "#fefefe",
              textAlign: "center",
            }}
          >
            <Box component="form" onSubmit={handleSubmit(handleSignIn)}>
              <Box fontSize={"1.5rem"} sx={{ py: 4 }}>
                Войти в аккаунт
              </Box>
              <Box
                sx={{
                  maxWidth: "400px",
                  margin: "0 auto",
                }}
              >
                <FormControl
                  sx={{ width: "100%", my: 1 }}
                  variant="outlined"
                  size="small"
                >
                  <InputLabel htmlFor="outlined-adornment-username">
                    Имя пользователя
                  </InputLabel>
                  <OutlinedInput
                    sx={{
                      width: "100%",
                    }}
                    id="outlined-adornment-username"
                    error={Boolean(errors.userName)}
                    {...register("userName")}
                    autoComplete="off"
                    label="Имя пользователя"
                  />
                </FormControl>
                {errors.userName && (
                  <Box
                    sx={{
                      color: "red",
                    }}
                  >
                    {errors.userName.message}
                  </Box>
                )}
                <FormControl
                  sx={{ width: "100%", my: 1 }}
                  variant="outlined"
                  size="small"
                >
                  <InputLabel htmlFor="outlined-adornment-password">
                    Пароль
                  </InputLabel>
                  <OutlinedInput
                    id="outlined-adornment-password"
                    error={Boolean(errors.password)}
                    {...register("password")}
                    autoComplete="off"
                    type={showPassword ? "text" : "password"}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label="Пароль"
                  />
                </FormControl>
                {errors.password && (
                  <Box
                    sx={{
                      color: "red",
                    }}
                  >
                    {errors.password.message}
                  </Box>
                )}
                <Box sx={{ py: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    Войти
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </FormProvider>
    </Box>
  );
};
