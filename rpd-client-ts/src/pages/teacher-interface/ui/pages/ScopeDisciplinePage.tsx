import {
  Box,
  Button,
  TextField,
  Typography as Tg,
  useTheme,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useScopeDisciplineForm } from "@pages/teacher-interface/model/useScopeDisciplineForm";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes";
import { PageTitleComment } from "@shared/ui";
import { FC } from "react";

type ScopeDisciplinePageProps = {
  readOnly?: boolean;
};

const disabledInputSx = (theme: Theme) => ({
  "& .MuiInputBase-input.Mui-disabled": {
    WebkitTextFillColor: theme.palette.text.primary,
    opacity: 1,
  },
});

const ScopeDisciplinePage: FC<ScopeDisciplinePageProps> = ({
  readOnly = false,
}) => {
  const theme = useTheme();
  const { creditUnits, setCreditUnits, academicHours, setAcademicHours, save } =
    useScopeDisciplineForm();

  return (
    <Box>
      <PageTitleComment
        title="Объем дисциплины"
        paddingBottom={2}
        templateField={TemplatePagesPath.DISCIPLINE_SCOPE}
      />
      <Tg sx={{ py: 2 }}>
        Объем дисциплины составляет
        <Tg
          component="span"
          sx={{
            fontWeight: "600",
            display: "inline-flex",
            mx: 1,
            alignItems: "baseline",
          }}
        >
          <TextField
            variant="standard"
            type="number"
            value={creditUnits}
            placeholder="?"
            onChange={(e) => setCreditUnits(e.target.value)}
            disabled={readOnly}
            sx={{
              width: 80,
              "& .MuiInputBase-input": {
                textAlign: "center",
              },
              ...(readOnly && disabledInputSx(theme)),
            }}
          />
        </Tg>
        зачетных единиц, всего
        <Tg
          component="span"
          sx={{
            fontWeight: "600",
            display: "inline-flex",
            mx: 1,
            alignItems: "baseline",
          }}
        >
          <TextField
            variant="standard"
            type="number"
            value={academicHours}
            placeholder="?"
            onChange={(e) => setAcademicHours(e.target.value)}
            disabled={readOnly}
            sx={{
              width: 80,
              "& .MuiInputBase-input": {
                textAlign: "center",
              },
              ...(readOnly && disabledInputSx(theme)),
            }}
          />
        </Tg>
        академических часа(ов)
      </Tg>

      {!readOnly && (
        <Box sx={{ pt: 1 }}>
          <Button variant="contained" onClick={save}>
            Сохранить
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ScopeDisciplinePage;
