import { InfoOutlined } from "@mui/icons-material";
import { IconButton, Tooltip, Typography } from "@mui/material";

const rules: string[] = [
  "Контактная работа — это лекции и практические занятия вместе с лабораторными",
  "Всего часов — контактная работа, самостоятельная работа и контроль, суммы считаются автоматически",
  "Часы контроля вводятся в строке «Промежуточная аттестация»",
];

export function DisciplineContentHelp() {
  return (
    <Tooltip
      describeChild
      slotProps={{ tooltip: { sx: { maxWidth: 440 } } }}
      title={rules.map((text) => (
        <Typography
          key={text}
          variant="inherit"
          sx={{ "&:not(:last-child)": { mb: 1 } }}
        >
          {text}
        </Typography>
      ))}
    >
      <IconButton aria-label="Правила заполнения">
        <InfoOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
