import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography as Tg,
} from "@mui/material";
import { useAssessmentToolsQuestions } from "../model/useAssessmentToolsQuestions";
import type { AssessmentToolQuestion } from "../model/types";
import { useState } from "react";

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

const captionLabelSx = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "text.secondary",
  mb: 0.5,
  display: "block",
  lineHeight: 1.2,
} as const;

const questionCardSx = {
  pl: 1.5,
  pr: 1.25,
  py: 1.5,
  bgcolor: "action.hover",
  borderLeft: "3px solid",
  borderLeftColor: "primary.main",
  transition: "background-color 120ms ease",
  "&:hover": {
    bgcolor: "rgba(25, 118, 210, 0.04)",
  },
} as const;

const sectionTitleSx = {
  fontSize: 13,
  fontWeight: 600,
  mb: 1.25,
  color: "text.primary",
  letterSpacing: "-0.01em",
} as const;

const emptyStateColor = "#6b6b6b";

type PoolKind = "open" | "closed";

type PoolQuestionCardProps = {
  q: AssessmentToolQuestion;
  competence: string;
  kind: PoolKind;
  checked: boolean;
  checkboxDisabled: boolean;
  toggleSelectedQuestion: (
    competence: string,
    kind: PoolKind,
    id: string,
    checked: boolean
  ) => void;
  updatePoolQuestionText: (
    competence: string,
    kind: PoolKind,
    id: string,
    text: string
  ) => void;
  updateCorrectAnswer: (
    competence: string,
    kind: PoolKind,
    id: string,
    value: string
  ) => void;
  removePoolQuestion: (competence: string, kind: PoolKind, id: string) => void;
};

function PoolQuestionCard({
  q,
  competence,
  kind,
  checked,
  checkboxDisabled,
  toggleSelectedQuestion,
  updatePoolQuestionText,
  updateCorrectAnswer,
  removePoolQuestion,
}: PoolQuestionCardProps) {
  return (
    <Box sx={questionCardSx}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Checkbox
          size="small"
          checked={checked}
          disabled={checkboxDisabled}
          onChange={(e) =>
            toggleSelectedQuestion(competence, kind, q.id, e.target.checked)
          }
          sx={{
            p: 0.5,
            mt: 0.25,
            "&.Mui-disabled": { opacity: 0.45 },
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: "grid", rowGap: 1.25 }}>
          <Box>
            <Tg
              component="label"
              htmlFor={`q-text-${kind}-${q.id}`}
              sx={captionLabelSx}
            >
              Вопрос
            </Tg>
            <TextField
              id={`q-text-${kind}-${q.id}`}
              fullWidth
              multiline
              minRows={2}
              size="small"
              placeholder="Формулировка вопроса"
              value={q.text}
              onChange={(e) =>
                updatePoolQuestionText(competence, kind, q.id, e.target.value)
              }
              sx={textFieldSx}
              variant="outlined"
            />
          </Box>
          <Box>
            <Tg
              component="label"
              htmlFor={`q-answer-${kind}-${q.id}`}
              sx={captionLabelSx}
            >
              Правильный ответ
            </Tg>
            <TextField
              id={`q-answer-${kind}-${q.id}`}
              fullWidth
              size="small"
              placeholder="Ответ для проверки / эталон"
              value={q.correctAnswer ?? ""}
              onChange={(e) =>
                updateCorrectAnswer(competence, kind, q.id, e.target.value)
              }
              sx={textFieldSx}
              variant="outlined"
            />
          </Box>
        </Box>
        <IconButton
          size="small"
          aria-label="Удалить вопрос"
          onClick={() => removePoolQuestion(competence, kind, q.id)}
          sx={{
            color: "text.secondary",
            borderRadius: 0,
            flexShrink: 0,
            "&:hover": {
              color: "error.main",
              bgcolor: "rgba(211, 47, 47, 0.06)",
            },
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

const DisciplineEvaluationsFundsForm = () => {
  const {
    competenceGroups,
    fundsData,
    handleControlQuestionsChange,
    addPoolQuestion,
    toggleSelectedQuestion,
    updateCorrectAnswer,
    updatePoolQuestionText,
    removePoolQuestion,
    saveFundsData,
    maxSelectableByCompetence,
    canSelectForCompetence,
  } = useAssessmentToolsQuestions();

  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>(
    {}
  );

  const addButtonSx = { borderRadius: 0, alignSelf: "flex-start" };

  return (
    <Box>
      <Box
        sx={{
          position: "fixed",
          top: 110,
          right: 95,
          zIndex: (theme) => theme.zIndex.appBar + 1,
        }}
      >
        <Button
          variant="contained"
          onClick={saveFundsData}
          sx={{
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          }}
        >
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
        <Box sx={{ mt: 2 }}>
          {competenceGroups.map((group) => {
            const competence = group.competence;
            const questions = fundsData.competencies[competence] ?? {
              openQuestions: "",
              closedQuestions: "",
              openPool: [],
              closedPool: [],
              selectedOpenIds: [],
              selectedClosedIds: [],
            };

            const openPool = questions.openPool ?? [];
            const closedPool = questions.closedPool ?? [];
            const selectedOpen = new Set(questions.selectedOpenIds ?? []);
            const selectedClosed = new Set(questions.selectedClosedIds ?? []);

            const maxOpenClosed = maxSelectableByCompetence[competence] ?? 0;
            const canSelect = canSelectForCompetence(competence);

            return (
              <Accordion
                key={competence}
                expanded={accordionOpen[competence] ?? false}
                onChange={(_, exp) =>
                  setAccordionOpen((p) => ({ ...p, [competence]: exp }))
                }
                disableGutters
                square
                sx={{
                  mt: 1,
                  borderRadius: 0,
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "none",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    px: 2,
                    minHeight: 48,
                    "& .MuiAccordionSummary-content": {
                      my: 1,
                    },
                  }}
                >
                  <Tg sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>
                    {competence}
                  </Tg>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0.5, px: 2, pb: 2.25 }}>
                  {!canSelect ? (
                    <Alert severity="warning" sx={{ mb: 2, borderRadius: 0 }}>
                      Нельзя выбрать вопросы: нет идентификатора комплекта или
                      по компетенции не найдено дисциплин в данных плана
                      результатов комплекта. Добавлять пункты в перечень
                      по-прежнему можно; отметить для включения в ФОС — после
                      появления данных комплекта.
                    </Alert>
                  ) : null}

                  <Stack spacing={2.5}>
                    <Box>
                      <Tg sx={sectionTitleSx}>Открытые вопросы</Tg>
                      <Button
                        variant="outlined"
                        sx={addButtonSx}
                        onClick={() => addPoolQuestion(competence, "open")}
                      >
                        Добавить вопрос
                      </Button>
                      <Tg
                        component="p"
                        sx={{
                          mt: 1,
                          mb: 0,
                          color: "text.secondary",
                          fontSize: 12,
                        }}
                      >
                        Выбрано {selectedOpen.size} из{" "}
                        {maxOpenClosed >= 1 ? maxOpenClosed : "—"}
                      </Tg>
                      <Divider sx={{ my: 1.25 }} />
                      <Stack spacing={1.25}>
                        {openPool.length === 0 ? (
                          <Tg sx={{ color: "text.secondary", fontSize: 13 }}>
                            Нет вопросов
                          </Tg>
                        ) : (
                          openPool.map((q) => {
                            const checked = selectedOpen.has(q.id);
                            const cap = maxOpenClosed >= 1 ? maxOpenClosed : 0;
                            const checkboxDisabled =
                              !canSelect ||
                              (!checked &&
                                selectedOpen.size >= cap &&
                                cap >= 1);
                            return (
                              <PoolQuestionCard
                                key={q.id}
                                q={q}
                                competence={competence}
                                kind="open"
                                checked={checked}
                                checkboxDisabled={checkboxDisabled}
                                toggleSelectedQuestion={toggleSelectedQuestion}
                                updatePoolQuestionText={updatePoolQuestionText}
                                updateCorrectAnswer={updateCorrectAnswer}
                                removePoolQuestion={removePoolQuestion}
                              />
                            );
                          })
                        )}
                      </Stack>
                    </Box>

                    <Box>
                      <Tg sx={sectionTitleSx}>Закрытые вопросы</Tg>
                      <Button
                        variant="outlined"
                        sx={addButtonSx}
                        onClick={() => addPoolQuestion(competence, "closed")}
                      >
                        Добавить вопрос
                      </Button>
                      <Tg
                        component="p"
                        sx={{
                          mt: 1,
                          mb: 0,
                          color: "text.secondary",
                          fontSize: 12,
                        }}
                      >
                        Выбрано {selectedClosed.size} из{" "}
                        {maxOpenClosed >= 1 ? maxOpenClosed : "—"}
                      </Tg>
                      <Divider sx={{ my: 1.25 }} />
                      <Stack spacing={1.25}>
                        {closedPool.length === 0 ? (
                          <Tg sx={{ color: "text.secondary", fontSize: 13 }}>
                            Нет вопросов
                          </Tg>
                        ) : (
                          closedPool.map((q) => {
                            const checked = selectedClosed.has(q.id);
                            const cap = maxOpenClosed >= 1 ? maxOpenClosed : 0;
                            const checkboxDisabled =
                              !canSelect ||
                              (!checked &&
                                selectedClosed.size >= cap &&
                                cap >= 1);
                            return (
                              <PoolQuestionCard
                                key={q.id}
                                q={q}
                                competence={competence}
                                kind="closed"
                                checked={checked}
                                checkboxDisabled={checkboxDisabled}
                                toggleSelectedQuestion={toggleSelectedQuestion}
                                updatePoolQuestionText={updatePoolQuestionText}
                                updateCorrectAnswer={updateCorrectAnswer}
                                removePoolQuestion={removePoolQuestion}
                              />
                            );
                          })
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default DisciplineEvaluationsFundsForm;
