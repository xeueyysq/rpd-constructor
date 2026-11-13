import { useAuth } from "@entities/auth";
import {
  createManualFeedbackDraft,
  useFeedbackAvailability,
  useSubmitFeedback,
  type FeedbackReceipt,
  type ManualFeedbackDraft,
} from "@entities/feedback";
import { UserRole } from "@shared/ability";
import { getSessionGeneration } from "@shared/api";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { useTheme } from "@mui/material/styles";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export function ReportProblemTrigger({
  placement,
}: {
  placement: "header" | "dialog";
}) {
  const role = useAuth((state) => state.userRole);
  const available = useFeedbackAvailability();
  if (!available || role === UserRole.ANONYMOUS) return null;

  const open = () => window.dispatchEvent(new Event("rpd:open-feedback"));
  const label = "Сообщить о проблеме";
  return placement === "header" ? (
    <IconButton
      color="inherit"
      onClick={open}
      aria-label={label}
      aria-keyshortcuts="Alt+Shift+P"
      title={`${label} (Alt+Shift+P)`}
    >
      <ReportProblemOutlinedIcon />
    </IconButton>
  ) : (
    <Button onClick={open} aria-keyshortcuts="Alt+Shift+P">
      {label}
    </Button>
  );
}

function ScreenshotPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? (
    <Box
      component="img"
      src={url}
      alt="Предпросмотр скриншота"
      sx={{
        display: "block",
        maxWidth: "100%",
        maxHeight: 180,
        objectFit: "contain",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    />
  ) : null;
}

export function ReportProblem() {
  const theme = useTheme();
  const role = useAuth((state) => state.userRole);
  const available = useFeedbackAvailability();
  const submit = useSubmitFeedback();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<ManualFeedbackDraft | null>(null);
  const [goal, setGoal] = useState("");
  const [actual, setActual] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [screenshot, setScreenshot] = useState<File>();
  const [fileError, setFileError] = useState("");
  const [sendError, setSendError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [receipt, setReceipt] = useState<FeedbackReceipt>();
  const fileInput = useRef<HTMLInputElement>(null);
  const visible = available && role !== UserRole.ANONYMOUS;

  const open = useCallback(() => {
    if (!visible || draft) return;
    setDraft(createManualFeedbackDraft());
    setGoal("");
    setActual("");
    setBlocking(false);
    setScreenshot(undefined);
    setFileError("");
    setSendError("");
    setCopyError("");
    setReceipt(undefined);
  }, [visible, draft]);

  const close = () => {
    if (submit.isPending) return;
    setDraft(null);
    setScreenshot(undefined);
    setReceipt(undefined);
  };

  useEffect(() => {
    const update = () => {
      const dialogs = document.querySelectorAll<HTMLElement>(
        ".MuiDialog-paper[role='dialog']:not(#report-problem-dialog)"
      );
      const top = dialogs.item(dialogs.length - 1);
      setAnchor(top);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (
        event.altKey &&
        event.shiftKey &&
        event.code === "KeyP" &&
        !event.repeat
      ) {
        event.preventDefault();
        open();
      }
    };
    const onOpen = () => open();
    document.addEventListener("keydown", onShortcut, true);
    window.addEventListener("rpd:open-feedback", onOpen);
    return () => {
      document.removeEventListener("keydown", onShortcut, true);
      window.removeEventListener("rpd:open-feedback", onOpen);
    };
  }, [open]);

  const acceptFile = (file: File) => {
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > MAX_SCREENSHOT_BYTES
    ) {
      setFileError("Нужен PNG или JPEG размером до 2 МиБ");
      return;
    }
    setScreenshot(file);
    setFileError("");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) acceptFile(file);
    event.currentTarget.value = "";
  };

  const onPaste = (event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files).find((item) =>
      item.type.startsWith("image/")
    );
    if (file) {
      event.preventDefault();
      acceptFile(file);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || submit.isPending) return;
    setSendError("");
    try {
      const result = await submit.mutateAsync({
        ...draft,
        goal,
        actual,
        blocking,
        screenshot,
      });
      if (draft.frozen.generation === getSessionGeneration())
        setReceipt(result);
    } catch {
      if (draft.frozen.generation === getSessionGeneration())
        setSendError(
          "Обращение пока не принято. Проверьте подключение и повторите отправку."
        );
    }
  };

  if (!visible) return null;

  const context = draft?.frozen.context;
  const contextLabel = [
    context?.discipline,
    context?.section,
    context?.complectId ? `Комплект № ${context.complectId}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {anchor
        ? createPortal(
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                px: 3,
                pb: 2,
              }}
            >
              <ReportProblemTrigger placement="dialog" />
            </Box>,
            anchor
          )
        : null}
      <Dialog
        open={Boolean(draft)}
        onClose={close}
        onPaste={onPaste}
        maxWidth="sm"
        fullWidth
        aria-labelledby="report-problem-title"
        slotProps={{
          paper: {
            id: "report-problem-dialog",
            sx: { maxHeight: "calc(100dvh - 32px)" },
          },
        }}
        sx={{ zIndex: theme.zIndex.modal + 2 }}
      >
        <DialogTitle id="report-problem-title">Сообщить о проблеме</DialogTitle>
        {receipt ? (
          <>
            <DialogContent>
              <Stack spacing={2}>
                <Alert severity="success">Обращение принято и сохранено.</Alert>
                <Typography>Номер обращения</Typography>
                <Typography
                  variant="h5"
                  sx={{ userSelect: "text", fontWeight: 600 }}
                >
                  {receipt.code}
                </Typography>
                {receipt.warning ? (
                  <Alert severity="warning">{receipt.warning}</Alert>
                ) : null}
                {copyError ? <Alert severity="info">{copyError}</Alert> : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  if (!navigator.clipboard) {
                    setCopyError("Выделите и скопируйте номер вручную.");
                    return;
                  }
                  void navigator.clipboard
                    .writeText(receipt.code)
                    .catch(() =>
                      setCopyError("Выделите и скопируйте номер вручную.")
                    );
                }}
              >
                Скопировать номер
              </Button>
              <Button variant="contained" onClick={close}>
                Закрыть
              </Button>
            </DialogActions>
          </>
        ) : (
          <Box
            component="form"
            onSubmit={(event) => void onSubmit(event)}
            sx={{ minHeight: 0, display: "flex", flexDirection: "column" }}
          >
            <DialogContent>
              <Stack spacing={2}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Опишите, что делали и что произошло. Это поможет разобраться с
                  проблемой.
                </Typography>
                {contextLabel ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Сейчас: {contextLabel}
                  </Typography>
                ) : null}
                <TextField
                  label="Что хотели сделать"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  required
                  multiline
                  minRows={2}
                  maxRows={4}
                  slotProps={{ htmlInput: { maxLength: 4000 } }}
                  fullWidth
                  autoFocus
                />
                <TextField
                  label="Что получилось"
                  value={actual}
                  onChange={(event) => setActual(event.target.value)}
                  required
                  multiline
                  minRows={3}
                  maxRows={5}
                  slotProps={{ htmlInput: { maxLength: 8000 } }}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={blocking}
                      onChange={(event) => setBlocking(event.target.checked)}
                    />
                  }
                  label="Не могу продолжить работу"
                />
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ flexWrap: "wrap", alignItems: "center" }}
                >
                  <Button
                    variant="outlined"
                    onClick={() => fileInput.current?.click()}
                  >
                    Прикрепить скриншот
                  </Button>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    PNG или JPEG, до 2 МиБ. Можно вставить из буфера.
                  </Typography>
                </Stack>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onFileChange}
                  style={{ display: "none" }}
                  aria-label="Выбрать скриншот"
                />
                {fileError ? <Alert severity="error">{fileError}</Alert> : null}
                {screenshot ? (
                  <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                    <ScreenshotPreview file={screenshot} />
                    <Button onClick={() => setScreenshot(undefined)}>
                      Удалить скриншот
                    </Button>
                  </Stack>
                ) : null}
                {sendError ? <Alert severity="error">{sendError}</Alert> : null}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button onClick={close} disabled={submit.isPending}>
                Отмена
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submit.isPending || !goal.trim() || !actual.trim()}
                startIcon={
                  submit.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                {submit.isPending ? "Отправляем…" : "Отправить обращение"}
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </>
  );
}
