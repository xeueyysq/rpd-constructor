import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FocusEvent, type FocusEventHandler } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { useTemplateSync } from "@entities/template";
import { useAssessmentToolsQuestions } from "./useAssessmentToolsQuestions";

vi.mock("@shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@shared/api")>()),
  axiosBase: { put: vi.fn() },
}));
vi.mock("@shared/lib/showMessage.ts", () => ({
  showErrorMessage: vi.fn(),
  showSuccessMessage: vi.fn(),
  showWarningMessage: vi.fn(),
}));
// SSR читает начальный Zustand snapshot. Для сценария задаём текущее состояние
// через настоящий store; заменяем только подписку, DOM и effects не моделируем.
vi.mock("@shared/hooks/useStore.tsx", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@shared/hooks/useStore.tsx")>();
  return {
    ...actual,
    useStore: Object.assign(
      <T>(
        selector: (state: ReturnType<typeof actual.useStore.getState>) => T
      ) => selector(actual.useStore.getState()),
      actual.useStore
    ),
  };
});

const edit = {
  userId: 7,
  fullname: "Иванова А.А.",
  at: "2026-11-01T11:00:00Z",
};
function model() {
  let result!: ReturnType<typeof useAssessmentToolsQuestions>;
  function Harness() {
    result = useAssessmentToolsQuestions();
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  return result;
}
async function settled() {
  await vi.waitFor(() => expect(useTemplateSync.getState().pending).toBe(0));
}

beforeEach(() => {
  vi.clearAllMocks();
  useTemplateSync.getState().reset();
  useStore.getState().setJsonData({
    id: 12,
    disciplins_name: "Математика",
    competencies: {
      "0": {
        competence: "УК-1",
        indicator: "УК-1.1",
        results: { know: "", beAble: "", own: "" },
      },
    },
    assessment_tools_questions: {
      controlQuestions: "",
      competencies: {
        "УК-1": {
          openQuestions: "",
          closedQuestions: "",
          openPool: [{ id: "q1", text: "", correctAnswer: "" }],
          closedPool: [],
          selectedOpenIds: [],
          selectedClosedIds: [],
        },
      },
    },
  });
  vi.mocked(axiosBase.put).mockImplementation(async (_url, payload) => ({
    data: {
      field: "assessment_tools_questions",
      value:
        payload && typeof payload === "object" && "value" in payload
          ? payload.value
          : undefined,
      edit,
    },
  }));
});

describe("сохранение редактируемого ФОС", () => {
  it("blur сохраняет последние вопрос, ответ и общие вопросы, игнорируя FocusEvent", async () => {
    const questions = model();
    questions.updatePoolQuestionText("УК-1", "open", "q1", "Новый вопрос");
    questions.updateCorrectAnswer("УК-1", "open", "q1", "Правильный ответ");
    questions.handleControlQuestionsChange("Общий контрольный вопрос");
    expect(axiosBase.put).not.toHaveBeenCalled();
    const target: { parent?: unknown } = {};
    target.parent = target;
    const blur: FocusEventHandler<HTMLInputElement> = questions.saveFundsData;
    expect(() =>
      blur({ target } as FocusEvent<HTMLInputElement>)
    ).not.toThrow();
    await settled();
    expect(axiosBase.put).toHaveBeenCalledOnce();
    expect(
      useStore.getState().jsonData.assessment_tools_questions
    ).toMatchObject({
      controlQuestions: "Общий контрольный вопрос",
      competencies: {
        "УК-1": {
          openPool: [
            {
              id: "q1",
              text: "Новый вопрос",
              correctAnswer: "Правильный ответ",
            },
          ],
        },
      },
    });
    expect(useTemplateSync.getState().dirty).toEqual({});
  });

  it("добавление и удаление сохраняются сразу, ошибка PUT оставляет данные dirty для повторного blur", async () => {
    const questions = model();
    questions.addPoolQuestion("УК-1", "closed", "Закрытый вопрос");
    await settled();
    expect(
      useStore.getState().jsonData.assessment_tools_questions.competencies[
        "УК-1"
      ].closedPool
    ).toEqual([expect.objectContaining({ text: "Закрытый вопрос" })]);
    questions.removePoolQuestion("УК-1", "open", "q1");
    await settled();
    expect(
      useStore.getState().jsonData.assessment_tools_questions.competencies[
        "УК-1"
      ].openPool
    ).toEqual([]);
    questions.handleControlQuestionsChange("Несохранённый вопрос");
    vi.mocked(axiosBase.put).mockRejectedValueOnce(
      new Error("Сеть недоступна")
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    questions.saveFundsData();
    await settled();
    expect(
      useTemplateSync.getState().dirty.assessment_tools_questions
    ).toBeDefined();
    questions.saveFundsData();
    await settled();
    expect(
      useStore.getState().jsonData.assessment_tools_questions.controlQuestions
    ).toBe("Несохранённый вопрос");
    expect(useTemplateSync.getState().dirty).toEqual({});
    consoleError.mockRestore();
  });
});
