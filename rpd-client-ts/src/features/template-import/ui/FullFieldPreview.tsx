import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

// HTML разбирается в отдельном inert-документе и никогда не вставляется в DOM.
// Сохраняем абзацы, списки и строки таблиц, выводя только текст React.
function plainText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") return String(value);
  if (!value.includes("<")) return value;
  const document = new DOMParser().parseFromString(value, "text/html");
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return "";
    const tag = node.tagName;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE"].includes(tag))
      return "";
    if (tag === "BR") return "\n";
    const children = Array.from(node.childNodes).map(read);
    if (tag === "TR") return `${children.join("\t")}\n`;
    const text = children.join("");
    if (tag === "LI") return `\n• ${text}\n`;
    return /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE)$/.test(tag)
      ? `\n${text}\n`
      : text;
  };
  return read(document.body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const hourLabels: Record<string, string> = {
  total: "Всего",
  lectures: "Лекции",
  seminars: "Практические",
  contact: "Контактная работа",
  independent_work: "Самостоятельная работа",
  control: "Контроль",
};

export function FullFieldPreview({
  value,
  content = false,
}: {
  value: unknown;
  content?: boolean;
}) {
  if (content && value && typeof value === "object" && !Array.isArray(value)) {
    const rows = Object.entries(value).flatMap(([id, row]) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? [{ id, values: row as Record<string, unknown> }]
        : []
    );
    if (!rows.length) return null;
    const keys = new Set(rows.flatMap((row) => Object.keys(row.values)));
    keys.delete("theme");
    const columns = [
      ...Object.keys(hourLabels).filter((key) => keys.has(key)),
      ...Array.from(keys).filter((key) => !(key in hourLabels)),
    ];
    return (
      <TableContainer
        tabIndex={0}
        role="region"
        aria-label="Таблица тем и часов, горизонтальная прокрутка"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const node = event.currentTarget;
          if (event.key === "ArrowRight") node.scrollLeft += 96;
          else if (event.key === "ArrowLeft") node.scrollLeft -= 96;
          else if (event.key === "End") node.scrollLeft = node.scrollWidth;
          else if (event.key === "Home") node.scrollLeft = 0;
          else return;
          event.preventDefault();
        }}
        sx={{
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          maxHeight: 296,
          overflow: "auto",
          overscrollBehavior: "contain",
        }}
      >
        <Table size="small" aria-label="Темы и часы" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 240 }}>Тема</TableCell>
              {columns.map((key) => (
                <TableCell key={key} align="right">
                  {hourLabels[key] ?? key}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell
                  sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {plainText(row.values.theme)}
                </TableCell>
                {columns.map((key) => (
                  <TableCell key={key} align="right">
                    {plainText(row.values[key]) || "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  if (Array.isArray(value))
    return value.length ? (
      <Box
        component="ol"
        sx={{ my: 0, pl: 3, typography: "body2", "& li + li": { mt: 1.5 } }}
      >
        {value.map((item, index) => (
          <Box
            component="li"
            key={index}
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {plainText(item)}
          </Box>
        ))}
      </Box>
    ) : null;
  return (
    <Typography
      variant="body2"
      sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
    >
      {plainText(value)}
    </Typography>
  );
}
