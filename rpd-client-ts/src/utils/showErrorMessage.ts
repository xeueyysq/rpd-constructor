import { VariantType, enqueueSnackbar } from "notistack";

export default (message: string) => {
  const variant: VariantType = 'error';
  return enqueueSnackbar(message, { variant });
}
