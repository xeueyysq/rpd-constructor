import {
  useFeedbackDeliveryStatus,
  useFeedbackDetail,
  useFeedbackScreenshot,
  type FeedbackDetail,
} from "@entities/feedback";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return "Нет доступа к этому обращению.";
    if (error.response?.status === 404) return "Обращение не найдено.";
  }
  return "Не удалось загрузить обращение. Проверьте подключение и повторите попытку.";
}

function Screenshot({ id }: { id: string }) {
  const image = useFeedbackScreenshot(id, true);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image.data) return;
    const next = URL.createObjectURL(image.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [image.data]);

  if (image.isPending) return <Typography>Загружаем скриншот…</Typography>;
  if (image.isError)
    return (
      <Alert
        severity="warning"
        action={<Button onClick={() => void image.refetch()}>Повторить</Button>}
      >
        Не удалось загрузить скриншот.
      </Alert>
    );
  return url ? (
    <Box
      component="img"
      src={url}
      alt="Скриншот обращения"
      sx={{
        display: "block",
        maxWidth: "100%",
        maxHeight: 520,
        objectFit: "contain",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    />
  ) : null;
}

function TechnicalDetails({ detail }: { detail: FeedbackDetail }) {
  const [copyError, setCopyError] = useState("");
  const diagnostic = {
    id: detail.id,
    code: detail.code,
    type: detail.type,
    createdAt: detail.createdAt,
    requestId: detail.requestId,
    operation: detail.operation,
    errorCode: detail.errorCode,
    status: detail.status,
    count: detail.count,
    lastSeen: detail.lastSeen,
    stack: detail.stack,
    context: detail.context,
    lastContext: detail.lastContext,
  };
  const breadcrumbs = detail.context.breadcrumbs?.slice(-10).reverse() ?? [];
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          Технические сведения
        </Typography>
        <Typography variant="body2">
          ID запроса: {detail.requestId ?? "не указан"}
        </Typography>
        <Typography variant="body2">
          Версия: {detail.context.clientRelease ?? "не указана"}
        </Typography>
        <Typography variant="body2">
          Страница: {detail.context.route ?? "не указана"}
        </Typography>
        <Typography variant="body2">
          Роль: {detail.context.primaryRole ?? "не указана"} /{" "}
          {detail.context.activeRole ?? "не указана"}
        </Typography>
        <Typography variant="body2">
          Браузер: {detail.context.browser ?? "не указан"}
        </Typography>
        {detail.context.discipline ? (
          <Typography variant="body2">
            Дисциплина: {detail.context.discipline}
          </Typography>
        ) : null}
        {detail.context.complectId != null ? (
          <Typography variant="body2">
            Комплект: {detail.context.complectId}
          </Typography>
        ) : null}
        {detail.context.templateId != null ? (
          <Typography variant="body2">
            Шаблон: {detail.context.templateId}
          </Typography>
        ) : null}
        {detail.context.section ? (
          <Typography variant="body2">
            Раздел: {detail.context.section}
          </Typography>
        ) : null}
        {["faculty", "direction", "profile", "form", "year"].some(
          (key) => detail.context[key as keyof typeof detail.context]
        ) ? (
          <Typography variant="body2">
            Программа:{" "}
            {[
              detail.context.faculty,
              detail.context.direction,
              detail.context.profile,
              detail.context.form,
              detail.context.year,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        ) : null}
        {breadcrumbs.length ? (
          <Box>
            <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>
              Последние действия
            </Typography>
            <Stack spacing={0.75}>
              {breadcrumbs.map((item, index) => (
                <Typography
                  variant="body2"
                  key={`${item.at}-${index}`}
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {dateTime(item.at)} — {item.operation ?? item.kind}
                  {item.method ? ` · ${item.method}` : ""}
                  {item.route ? ` ${item.route}` : ""}
                  {item.status ? ` · HTTP ${item.status}` : ""}
                  {item.requestId ? ` · ${item.requestId}` : ""}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}
        {detail.stack ? (
          <Box
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              m: 0,
              fontSize: "0.8rem",
            }}
          >
            {detail.stack}
          </Box>
        ) : null}
        {detail.lastContext ? (
          <Box>
            <Typography variant="subtitle1" component="h3">
              Последний контекст
            </Typography>
            <Box
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: "0.8rem",
              }}
            >
              {JSON.stringify(detail.lastContext, null, 2)}
            </Box>
          </Box>
        ) : null}
        <Button
          sx={{ alignSelf: "flex-start" }}
          variant="outlined"
          onClick={() => {
            if (!navigator.clipboard) {
              setCopyError("Не удалось скопировать сведения.");
              return;
            }
            void navigator.clipboard
              .writeText(JSON.stringify(diagnostic, null, 2))
              .catch(() => setCopyError("Не удалось скопировать сведения."));
          }}
        >
          Скопировать диагностику
        </Button>
        {copyError ? <Alert severity="warning">{copyError}</Alert> : null}
      </Stack>
    </Paper>
  );
}

function DeliverySummary() {
  const status = useFeedbackDeliveryStatus();
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        Доставка обращений
      </Typography>
      {status.isPending ? <Typography>Проверяем состояние…</Typography> : null}
      {status.isError ? (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => void status.refetch()}>Повторить</Button>
          }
        >
          Не удалось узнать состояние доставки.
        </Alert>
      ) : null}
      {status.data ? (
        <Stack spacing={0.5}>
          <Typography variant="body2">
            Состояние:{" "}
            {status.data.deliveryReady
              ? "готова"
              : status.data.deliveryEnabled
                ? "ожидает настройки"
                : "выключена"}
          </Typography>
          <Typography variant="body2">
            Ожидают отправки: {status.data.pending}
          </Typography>
          <Typography variant="body2">
            Сейчас отправляются: {status.data.leased}
          </Typography>
          <Typography variant="body2">
            Старейшее в очереди: {dateTime(status.data.oldestPending)}
          </Typography>
          {status.data.cooldownUntil ? (
            <Typography variant="body2">
              Следующая попытка: {dateTime(status.data.cooldownUntil)}
            </Typography>
          ) : null}
          {status.data.lastError ? (
            <Alert severity="warning">
              Последняя ошибка доставки: {status.data.lastError}
            </Alert>
          ) : null}
        </Stack>
      ) : null}
    </Paper>
  );
}

export function FeedbackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useFeedbackDetail(id);

  if (detail.isPending) return <Typography>Загружаем обращение…</Typography>;
  if (detail.isError)
    return (
      <Alert
        severity="error"
        action={
          <Button onClick={() => void detail.refetch()}>Повторить</Button>
        }
      >
        {errorMessage(detail.error)}
      </Alert>
    );

  const report = detail.data;
  return (
    <Box sx={{ maxWidth: 960, mx: "auto", pb: 4 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
          }}
          spacing={1}
        >
          <Box>
            <Typography variant="h4" component="h1">
              Обращение {report.code}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Создано {dateTime(report.createdAt)}
            </Typography>
          </Box>
          <Chip
            label={
              report.type === "manual"
                ? "Сообщение пользователя"
                : "Автоматическая диагностика"
            }
            variant="outlined"
          />
        </Stack>
        <Paper variant="outlined" sx={{ p: 2 }}>
          {report.type === "manual" ? (
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                Описание
              </Typography>
              <Box>
                <Typography variant="subtitle2">Что хотели сделать</Typography>
                <Typography
                  sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {report.goal}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Что получилось</Typography>
                <Typography
                  sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {report.actual}
                </Typography>
              </Box>
              <Typography>
                Не может продолжить работу: {report.blocking ? "да" : "нет"}
              </Typography>
              {report.warning ? (
                <Alert severity="warning">{report.warning}</Alert>
              ) : null}
              {report.screenshotMime ? (
                <>
                  <Divider />
                  <Typography variant="subtitle1" component="h3">
                    Скриншот
                  </Typography>
                  <Screenshot id={report.id} />
                </>
              ) : null}
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                Причина и частота
              </Typography>
              <Typography>Операция: {report.operation}</Typography>
              <Typography>Код ошибки: {report.errorCode}</Typography>
              <Typography>HTTP: {report.status ?? "не указан"}</Typography>
              <Typography>Повторений: {report.count}</Typography>
              <Typography>
                Первый случай: {dateTime(report.createdAt)}
              </Typography>
              <Typography>
                Последний случай: {dateTime(report.lastSeen)}
              </Typography>
            </Stack>
          )}
        </Paper>
        <TechnicalDetails detail={report} />
        <DeliverySummary />
      </Stack>
    </Box>
  );
}
