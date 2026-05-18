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
import { axiosBase } from "@shared/api";
import { showErrorMessage } from "@shared/lib";
import { FC, useEffect, useMemo, useState } from "react";

export type BuildFundsByComplectDialogProps = {
  open: boolean;
  complectId: string;
  onClose: () => void;
};

type ResultsRow = {
  competence: string;
  indicator: string;
  disciplines: string[];
};

export const BuildFundsByComplectDialog: FC<
  BuildFundsByComplectDialogProps
> = ({ open, complectId, onClose }) => {
  const [rows, setRows] = useState<ResultsRow[]>([]);
  const [selectedCompetence, setSelectedCompetence] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const competencies = useMemo(() => {
    return [
      ...new Set(rows.map((row) => row.competence).filter((value) => value)),
    ];
  }, [rows]);

  useEffect(() => {
    if (!open) return;

    let isActive = true;
    setIsLoading(true);
    setSelectedCompetence("");

    (async () => {
      try {
        const { data } = await axiosBase.get<ResultsRow[]>("get-results-data", {
          params: { complectId },
        });
        if (!isActive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        showErrorMessage("Не удалось загрузить компетенции комплекта");
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [open, complectId]);

  useEffect(() => {
    if (!selectedCompetence && competencies.length > 0) {
      setSelectedCompetence(competencies[0]);
    }
  }, [competencies, selectedCompetence]);

  const handleGenerateDocx = async () => {
    if (!selectedCompetence) return;

    setIsGenerating(true);
    try {
      const response = await axiosBase.post<Blob>(
        "generate-assessment-funds-docx",
        {
          complectId,
          competence: selectedCompetence,
        },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedCompetence.slice(0, 80)}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось сформировать Word-документ");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Сформировать ФОС</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Выберите компетенцию, вопросы которой нужно отразить в Word-документе
        </Typography>
        {isLoading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={18} />
            <Typography color="text.secondary">
              Загрузка компетенций…
            </Typography>
          </Box>
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
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: {
                    maxHeight: 320,
                    maxWidth: 900,
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
          variant="contained"
          onClick={handleGenerateDocx}
          disabled={!selectedCompetence || isLoading || isGenerating}
        >
          {isGenerating ? "Формирование…" : "Скачать Word"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
