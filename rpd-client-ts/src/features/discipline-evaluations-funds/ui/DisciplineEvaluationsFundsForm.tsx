import { Box, Button, Paper, TextField, Typography as Tg } from "@mui/material";
import { useAssessmentToolsQuestions } from "../model/useAssessmentToolsQuestions";

const textFieldSx = {
  "& .MuiInputBase-root": {
    borderRadius: 0,
    backgroundColor: "#ffffff",
    fontSize: "14px",
  },
  "& .MuiInputBase-input": {
    fontSize: "14px",
    color: "#1f1f1f",
  },
  "& .MuiInputLabel-root": {
    fontSize: "14px",
    color: "#4a4a4a",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#bdbdbd",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#7a7a7a",
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#1976d2",
  },
} as const;

const emptyStateColor = "#6b6b6b";

const DisciplineEvaluationsFundsForm = () => {
  const {
    competenceGroups,
    fundsData,
    handleControlQuestionsChange,
    handleQuestionChange,
    saveFundsData,
  } = useAssessmentToolsQuestions();

  return (
    <Box>
      <Box pt={2} display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={saveFundsData}>
          Сохранить
        </Button>
      </Box>

      <Box sx={{ mt: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={4}
          label="Контрольные вопросы по экзамену/зачету"
          value={fundsData.controlQuestions}
          onChange={(e) => handleControlQuestionsChange(e.target.value)}
          sx={textFieldSx}
        />
      </Box>

      {competenceGroups.length === 0 ? (
        <Box sx={{ mt: 3, color: emptyStateColor }}>
          Компетенции не найдены. Заполните раздел планируемых результатов
          обучения, чтобы добавить вопросы по компетенциям.
        </Box>
      ) : (
        <Box sx={{ mt: 3 }}>
          {competenceGroups.map((group) => {
            const questions = fundsData.competencies[group.competence] ?? {
              openQuestions: "",
              closedQuestions: "",
            };

            return (
              <Paper
                key={group.competence}
                sx={{ p: 2, mt: 2, borderRadius: 0 }}
              >
                <Tg sx={{ fontWeight: 600 }}>{group.competence}</Tg>

                <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Открытые вопросы"
                    value={questions.openQuestions}
                    onChange={(e) =>
                      handleQuestionChange(
                        group.competence,
                        "openQuestions",
                        e.target.value
                      )
                    }
                    sx={textFieldSx}
                  />
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Закрытые вопросы"
                    value={questions.closedQuestions}
                    onChange={(e) =>
                      handleQuestionChange(
                        group.competence,
                        "closedQuestions",
                        e.target.value
                      )
                    }
                    sx={textFieldSx}
                  />
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default DisciplineEvaluationsFundsForm;
