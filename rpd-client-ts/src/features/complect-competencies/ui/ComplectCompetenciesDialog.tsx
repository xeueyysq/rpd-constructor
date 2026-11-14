import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  useComplectCompetencies,
  useUploadComplectCompetencies,
} from "@entities/rpd-complect";
import {
  getSessionGeneration,
  subscribeToSessionGeneration,
} from "@shared/api";
import { groupCompetencies } from "../lib/groupCompetencies";
import { CompactDialogTheme } from "@shared/ui";
import { useLocation } from "react-router-dom";
import {
  freezeDiagnosticContext,
  safeEntityContext,
  setDiagnosticEntity,
} from "@shared/diagnostics";

export interface CompetenciesTarget {
  id: number;
  label: string;
}

export function ComplectCompetenciesDialog({
  complect,
  onClose,
}: {
  complect: CompetenciesTarget | null;
  onClose: () => void;
}) {
  const generation = useSyncExternalStore(
    subscribeToSessionGeneration,
    getSessionGeneration
  );
  return complect ? (
    <CompactDialogTheme>
      <CompetenciesSession
        key={`${complect.id}:${generation}`}
        complect={complect}
        onClose={onClose}
      />
    </CompactDialogTheme>
  ) : null;
}

function CompetenciesSession({
  complect,
  onClose,
}: {
  complect: CompetenciesTarget;
  onClose: () => void;
}) {
  const titleId = useId();
  const { pathname } = useLocation();
  const mobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const query = useComplectCompetencies(complect.id);
  const upload = useUploadComplectCompetencies();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    severity: "error" | "success";
    text: string;
  } | null>(null);
  const active = useRef(true);
  const uploading = useRef(false);
  useEffect(() => {
    active.current = true;
    const previous = freezeDiagnosticContext();
    setDiagnosticEntity(
      {
        ...safeEntityContext(previous.context),
        complectId: complect.id,
        section: "Компетенции",
      },
      pathname,
      previous.generation
    );
    return () => {
      active.current = false;
      setDiagnosticEntity(
        safeEntityContext(previous.context),
        pathname,
        previous.generation
      );
    };
  }, [complect.id, pathname]);
  const close = () => {
    active.current = false;
    onClose();
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || uploading.current) return;
    const id = complect.id;
    const generation = getSessionGeneration();
    uploading.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const { parseCsvToJson } =
        await import("@shared/ability/lib/parseCsvToJson");
      if (!active.current || generation !== getSessionGeneration()) return;
      const data = groupCompetencies(await parseCsvToJson(file));
      if (!active.current || generation !== getSessionGeneration()) return;
      await upload.mutateAsync({ complectId: id, data, generation });
      if (active.current && generation === getSessionGeneration())
        setMessage({ severity: "success", text: "Компетенции сохранены" });
    } catch (error) {
      if (active.current && generation === getSessionGeneration())
        setMessage({
          severity: "error",
          text:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить компетенции",
        });
    } finally {
      uploading.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={close}
      fullScreen={mobile}
      fullWidth
      maxWidth="xl"
      aria-labelledby={titleId}
      slotProps={{
        paper: {
          sx: {
            height: { sm: "calc(100dvh - 32px)" },
            maxHeight: { sm: "calc(100dvh - 32px)" },
            minHeight: 0,
          },
        },
      }}
    >
      <DialogTitle id={titleId}>
        Компетенции
        <Typography component="div" sx={{ color: "text.secondary", mt: 0.5 }}>
          {complect.label}
        </Typography>
      </DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          overflow: "hidden",
        }}
      >
        <Box>
          <Button
            component="label"
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
            disabled={busy || query.isPending}
          >
            Загрузить файл
            <input
              hidden
              type="file"
              accept=".csv,.xlsx"
              aria-label="Файл компетенций"
              disabled={busy || query.isPending}
              onChange={(event) => void handleFile(event)}
            />
          </Button>
        </Box>
        {busy || query.isFetching ? (
          <LinearProgress aria-label="Загрузка компетенций" />
        ) : null}
        {message ? (
          <Alert severity={message.severity}>{message.text}</Alert>
        ) : null}
        {query.isError ? (
          <Alert
            severity="error"
            action={
              <Button onClick={() => void query.refetch()}>Повторить</Button>
            }
          >
            Не удалось прочитать компетенции
          </Alert>
        ) : null}
        <TableContainer
          sx={{ flex: 1, minHeight: 0, border: 1, borderColor: "divider" }}
        >
          <Table
            stickyHeader
            size="small"
            aria-label="Компетенции комплекта"
            sx={{
              tableLayout: "fixed",
              height: query.data?.length ? undefined : "100%",
              "& th, & td": { p: 1.5, verticalAlign: "top" },
            }}
          >
            <TableHead sx={{ height: "1px" }}>
              <TableRow>
                <TableCell>
                  Формируемые компетенции (код и наименование)
                </TableCell>
                <TableCell>
                  Индикаторы достижения компетенций (код и формулировка)
                </TableCell>
                <TableCell>Дисциплины</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.data?.length ? (
                query.data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {index === 0 ||
                      row.competence !== query.data[index - 1].competence
                        ? row.competence
                        : ""}
                    </TableCell>
                    <TableCell>{row.indicator}</TableCell>
                    <TableCell>{row.disciplines.join(", ")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    sx={{
                      "&&": { verticalAlign: "middle", textAlign: "center" },
                    }}
                  >
                    <Typography component="span">
                      {query.isPending
                        ? "Загрузка…"
                        : "Компетенции пока не были загружены"}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
