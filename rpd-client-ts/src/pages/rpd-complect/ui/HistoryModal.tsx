import { statusConfig } from "@entities/template/model/templateStatusCodes";
import {
  Box,
  Breadcrumbs,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface history {
  date: string;
  user: string;
  status: string;
}
interface HistoryModal {
  history: history[];
  openDialog: boolean;
  setOpenDialog: (open: boolean) => void;
}

function HistoryModal({ history, openDialog, setOpenDialog }: HistoryModal) {
  const formattedDate = (date: string) =>
    format(parseISO(date), "d MMMM yyyy, HH:mm", { locale: ru });

  return (
    <Dialog
      maxWidth={"lg"}
      open={openDialog}
      onClose={() => setOpenDialog(false)}
    >
      <DialogTitle>История шаблона</DialogTitle>
      <DialogContent>
        <Breadcrumbs maxItems={4} separator={<ArrowForwardIcon />}>
          {...history.map((data, index) => (
            <Box key={index} sx={{ p: 1 }}>
              <Box>{formattedDate(data.date)}</Box>
              <Box>{data.user}</Box>
              <Box>{statusConfig[data.status]?.label}</Box>
            </Box>
          ))}
        </Breadcrumbs>
      </DialogContent>
      <DialogActions>
        <Button variant={"contained"} onClick={() => setOpenDialog(false)}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default HistoryModal;
