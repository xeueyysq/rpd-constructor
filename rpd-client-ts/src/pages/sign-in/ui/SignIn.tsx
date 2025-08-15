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
  OutlinedInput,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { AuthContext } from "@entities/auth";
import { signInSchema } from "../model/signInSchema.ts";

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
    <FormProvider {...formMethods}>
      <Box alignContent={"center"} height={"85vh"}>
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
            <Box component="h2" sx={{ py: 4 }}>
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
  );
};
