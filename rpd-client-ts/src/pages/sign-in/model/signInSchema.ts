import * as Yup from "yup"

const signInSchema = Yup.object({
    userName: Yup.string()
        .required("Поле обязательно!")
        .max(25, "Максимальная длина - 25 символов"),
    password: Yup.string()
        .required("Поле обязательно!")
        .min(3, "Пароль слишком короткий - минимум 3 символа")
        .max(50, "Максимальная длина - 50 символов"),
})

export {signInSchema}
