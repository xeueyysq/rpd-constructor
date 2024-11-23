import {enqueueSnackbar, VariantType} from "notistack";

export const showErrorMessage = (message: string) => {
    const variant: VariantType = 'error';
    return enqueueSnackbar(message, {variant});
}

export const showSuccessMessage = (message: string) => {
    const variant: VariantType = 'success';
    return enqueueSnackbar(message, {variant});
}
