import { Box, TextField, Typography as Tg, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useScopeDisciplineForm } from "@pages/teacher-interface/model/useScopeDisciplineForm";
import { TemplatePagesPath } from "@shared/enums";
import { FieldChangeNotice } from "@shared/ui/FieldChangeNotice";
import { PageTitleComment } from "../PageTitleComment";
import { useFieldChanges } from "@pages/teacher-interface/model/useFieldChanges";
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
  const { fieldChanges } = useFieldChanges();

  return (
    <Box>
      <PageTitleComment
        title="Объем дисциплины"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.DISCIPLINE_SCOPE}
        fields={["zet", "study_load"]}
      />
      <FieldChangeNotice fieldKey="zet" changes={fieldChanges} />
      <FieldChangeNotice fieldKey="study_load" changes={fieldChanges} />
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
            onBlur={() => void save("zet")}
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
            onBlur={() => void save("study_load")}
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
    </Box>
  );
};

export default ScopeDisciplinePage;
