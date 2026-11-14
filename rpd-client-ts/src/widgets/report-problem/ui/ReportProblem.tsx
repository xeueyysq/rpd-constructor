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
import { useStore } from "@shared/hooks";
import { CompactDialogTheme } from "@shared/ui";
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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
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

function ReportProblemTrigger({
  onOpen,
  hidden,
}: {
  onOpen: () => void;
  hidden: boolean;
}) {
  const expanded = useStore((state) => state.isDrawerOpen);
  const label = "Сообщить о проблеме";
  return (
    <Tooltip title={label + " (Alt+Shift+P)"}>
      <Button
        className="mui-fixed"
        variant="outlined"
        onClick={onOpen}
        aria-label={label}
        aria-keyshortcuts="Alt+Shift+P"
        sx={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: (theme) => theme.zIndex.modal + 1,
          display: hidden ? "none" : "inline-flex",
          bgcolor: "background.paper",
          minHeight: 36,
          minWidth: 36,
          width: { xs: 36, sm: expanded ? "auto" : 36 },
          px: { xs: 0, sm: expanded ? 1.5 : 0 },
          gap: 1,
          "&:hover": { bgcolor: "background.paper" },
        }}
      >
        <ReportProblemOutlinedIcon />
        <Box
          component="span"
          sx={{ display: { xs: "none", sm: expanded ? "inline" : "none" } }}
        >
          {label}
        </Box>
      </Button>
    </Tooltip>
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
  return (
    <CompactDialogTheme>
      <ReportProblemForm />
    </CompactDialogTheme>
  );
}

function ReportProblemForm() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
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
  const focusOrigin = useRef<HTMLElement | null>(null);
  const visible = available && role !== UserRole.ANONYMOUS;

  const open = useCallback(() => {
    if (!visible || draft) return;
    focusOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
    if (draft) return;
    const update = () => {
      // Пока форма закрывается, нижнее окно ещё inert. Сохраняем её инициатор
      // до завершения transition, чтобы не потерять узел возврата фокуса.
      if (document.getElementById("report-problem-dialog")) return;
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".MuiDialog-paper[role='dialog']:not(#report-problem-dialog)"
        )
      ).filter(
        (paper) =>
          paper.closest(".MuiModal-root")?.getAttribute("aria-hidden") !==
          "true"
      );
      const top = dialogs.at(-1);
      // Fixed-контрол не занимает строку; он остаётся внутри aria-modal и focus trap.
      setAnchor(top ?? null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden"],
    });
    return () => observer.disconnect();
  }, [draft]);

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
    if (submit.isPending) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size === 0 ||
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
    if (submit.isPending) return;
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

  return (
    <>
      {createPortal(
        <ReportProblemTrigger onOpen={open} hidden={Boolean(draft)} />,
        anchor ?? document.body
      )}
      <Dialog
        open={Boolean(draft)}
        onClose={close}
        onPaste={onPaste}
        maxWidth={false}
        fullWidth
        fullScreen={mobile}
        aria-labelledby="report-problem-title"
        slotProps={{
          transition: {
            onExited: () => {
              window.requestAnimationFrame(() => {
                if (focusOrigin.current?.isConnected)
                  focusOrigin.current.focus();
              });
            },
          },
          paper: {
            id: "report-problem-dialog",
            sx: {
              width: mobile ? "100%" : "calc(100% - 32px)",
              maxWidth: mobile ? "none" : 800,
              m: mobile ? 0 : 2,
              maxHeight: mobile ? "100dvh" : "calc(100dvh - 32px)",
            },
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
            sx={{
              minHeight: 0,
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <DialogContent>
              <Stack spacing={2}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Откройте эту форму со страницы или из окна, где возникла
                  проблема: так контекст обращения определится автоматически.
                  Опишите, что хотели сделать и что получилось.
                </Typography>
                <Stack spacing={0.5}>
                  <Typography
                    component="label"
                    htmlFor="report-problem-goal"
                    variant="body2"
                  >
                    Что хотели сделать
                  </Typography>
                  <TextField
                    id="report-problem-goal"
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    required
                    multiline
                    minRows={mobile ? 5 : 6}
                    maxRows={12}
                    disabled={submit.isPending}
                    slotProps={{ htmlInput: { maxLength: 4000 } }}
                    fullWidth
                    autoFocus
                  />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography
                    component="label"
                    htmlFor="report-problem-actual"
                    variant="body2"
                  >
                    Что получилось
                  </Typography>
                  <TextField
                    id="report-problem-actual"
                    value={actual}
                    onChange={(event) => setActual(event.target.value)}
                    required
                    multiline
                    minRows={mobile ? 5 : 8}
                    maxRows={12}
                    disabled={submit.isPending}
                    slotProps={{ htmlInput: { maxLength: 8000 } }}
                    fullWidth
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox
                      disabled={submit.isPending}
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
                    size="small"
                    startIcon={<AttachFileIcon />}
                    disabled={submit.isPending}
                    onClick={() => fileInput.current?.click()}
                  >
                    Прикрепить скриншот
                  </Button>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    PNG или JPEG, до 2 МиБ. Можно вставить из буфера.
                  </Typography>
                </Stack>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={submit.isPending}
                  onChange={onFileChange}
                  style={{ display: "none" }}
                  aria-label="Выбрать скриншот"
                />
                {fileError ? <Alert severity="error">{fileError}</Alert> : null}
                {screenshot ? (
                  <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                    <Typography
                      variant="caption"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {screenshot.name} · {Math.ceil(screenshot.size / 1024)}{" "}
                      КиБ
                    </Typography>
                    <ScreenshotPreview file={screenshot} />
                    <Button
                      disabled={submit.isPending}
                      onClick={() => setScreenshot(undefined)}
                    >
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
