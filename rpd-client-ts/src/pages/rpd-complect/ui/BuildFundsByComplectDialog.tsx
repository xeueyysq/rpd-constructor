import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import {
  useAssessmentFundsCompetencies,
  useDownloadAssessmentFundsExcel,
  useDownloadAssessmentFundsWord,
} from "@features/assessment-funds";
import { downloadBlob, showErrorMessage } from "@shared/lib";
import { FC, useEffect, useMemo, useState } from "react";

export type BuildFundsByComplectDialogProps = {
  open: boolean;
  complectId: string;
  onClose: () => void;
};

export const BuildFundsByComplectDialog: FC<
  BuildFundsByComplectDialogProps
> = ({ open, complectId, onClose }) => {
  const [selectedCompetence, setSelectedCompetence] = useState("");
  const {
    data: rows = [],
    isPending: isLoading,
    isError,
  } = useAssessmentFundsCompetencies(complectId, open);
  const word = useDownloadAssessmentFundsWord();
  const excel = useDownloadAssessmentFundsExcel();
  const isGenerating = word.isPending || excel.isPending;

  const competencies = useMemo(() => {
    return [
      ...new Set(rows.map((row) => row.competence).filter((value) => value)),
    ];
  }, [rows]);
  const downloadBlocked =
    isLoading || isError || isGenerating || competencies.length === 0;

  useEffect(() => {
    if (!open) return;
    setSelectedCompetence("");
  }, [open]);

  useEffect(() => {
    if (!selectedCompetence && competencies.length > 0) {
      setSelectedCompetence(competencies[0]);
    }
  }, [competencies, selectedCompetence]);

  const handleGenerateDocx = async () => {
    if (!selectedCompetence) return;

    try {
      const blob = await word.mutateAsync({
        complectId,
        competence: selectedCompetence,
      });
      downloadBlob(blob, `${selectedCompetence.slice(0, 80)}.docx`);
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось сформировать Word-документ");
    }
  };

  const handleGenerateExcel = async () => {
    if (downloadBlocked) return;

    try {
      const { blob, filename } = await excel.mutateAsync(complectId);
      downloadBlob(blob, filename);
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось сформировать Excel-файл");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Сформировать ФОС</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Word содержит вопросы выбранной компетенции. Excel содержит выбранные
          вопросы всех компетенций комплекта в формате таблицы.
        </Typography>
        {isLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} />
            <Typography color="text.secondary">
              Загрузка компетенций…
            </Typography>
          </Box>
        ) : isError ? (
          <Alert severity="error">
            Не удалось загрузить компетенции комплекта
          </Alert>
        ) : competencies.length === 0 ? (
          <Alert severity="warning">
            В комплекте не найдены компетенции. Сначала загрузите планируемые
            результаты.
          </Alert>
        ) : (
          <TextField
            select
            label="Компетенция"
            value={selectedCompetence}
            onChange={(e) => setSelectedCompetence(e.target.value)}
            sx={{ width: "100%", maxWidth: 900 }}
            slotProps={{
              select: {
                MenuProps: {
                  slotProps: {
                    paper: {
                      sx: {
                        maxHeight: 320,
                        maxWidth: 900,
                      },
                    },
                  },
                },
              },
            }}
          >
            {competencies.map((competence) => (
              <MenuItem key={competence} value={competence}>
                {competence}
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isGenerating}>
          Закрыть
        </Button>
        <Button
          variant="outlined"
          onClick={handleGenerateExcel}
          disabled={downloadBlocked}
        >
          {excel.isPending ? "Формирование…" : "Скачать Excel"}
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerateDocx}
          disabled={downloadBlocked || !selectedCompetence}
        >
          {word.isPending ? "Формирование…" : "Скачать Word"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
