import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import { useTemplateSync } from "../model/templateSync";
import { useUpdateTemplateField } from "./updateTemplateField";

// Проверяем запрос и состояние без монтирования компонента и браузерного DOM.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("@shared/api", () => ({ axiosBase: { put: vi.fn() } }));
vi.mock("@shared/lib", () => ({ showErrorMessage: vi.fn() }));

const before = "2026-09-30T10:00:00Z";
const after = "2026-09-30T10:01:00Z";
const edit = { userId: 7, fullname: "Иванов И.И.", at: after };

describe("сохранение текстового черновика", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTemplateSync.getState().reset();
    useStore.getState().setJsonData({
      id: 12,
      goals: "Исходные цели",
      field_edits: { goals: { ...edit, at: before } },
    });
  });

  it("передаёт исходный baseAt и снимает dirty только после успешного PUT", async () => {
    vi.mocked(axiosBase.put).mockResolvedValue({
      data: { field: "goals", value: "Новые цели", edit },
    });
    useTemplateSync.getState().markDirty("goals");
    expect(
      await useUpdateTemplateField()("goals", "Новые цели", {
        keepDraftOnConflict: true,
      })
    ).toBe(true);
    expect(axiosBase.put).toHaveBeenCalledWith("update-json-value/12", {
      fieldToUpdate: "goals",
      value: "Новые цели",
      baseAt: before,
    });
    expect(useStore.getState().jsonData.goals).toBe("Новые цели");
    expect(useTemplateSync.getState().dirty).toEqual({});
    expect(useTemplateSync.getState().savedAt).not.toBeNull();
  });

  it("после 409 хранит актуальное значение и оставляет черновик dirty до отмены", async () => {
    vi.mocked(axiosBase.put).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { value: "Чужие цели", edit } } },
    });
    expect(
      await useUpdateTemplateField()("goals", "Мой черновик", {
        keepDraftOnConflict: true,
      })
    ).toBe(false);
    expect(useStore.getState().jsonData.goals).toBe("Чужие цели");
    expect(useStore.getState().jsonData.field_edits.goals.at).toBe(after);
    expect(useTemplateSync.getState().dirty.goals).toBeDefined();
    expect(useTemplateSync.getState().savedAt).toBeNull();
    expect(useTemplateSync.getState().pending).toBe(0);
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("Черновик оставлен в редакторе")
    );
    useTemplateSync.getState().clearDirty("goals");
    expect(useTemplateSync.getState().dirty).toEqual({});
  });

  it("сохраняет прежнюю обработку 409 для ячеек и других мгновенных изменений", async () => {
    vi.mocked(axiosBase.put).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { value: "Чужие цели", edit } } },
    });
    expect(await useUpdateTemplateField()("goals", "Моё значение")).toBe(false);
    expect(useTemplateSync.getState().dirty).toEqual({});
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("Показано актуальное значение")
    );
  });

  it("сохраняет вопросы, ответы и общие контрольные вопросы ФОС как JSON; новые правки остаются dirty до следующего сохранения", async () => {
    const funds = {
      controlQuestions: "Общий контрольный вопрос",
      competencies: {
        "УК-1": {
          openQuestions: "Открытый вопрос",
          closedQuestions: "",
          openPool: [
            {
              id: "q1",
              text: "Открытый вопрос",
              correctAnswer: "Правильный ответ",
            },
          ],
          closedPool: [],
          selectedOpenIds: ["q1"],
          selectedClosedIds: [],
        },
      },
    };
    let finish!: (value: unknown) => void;
    vi.mocked(axiosBase.put).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const save = useUpdateTemplateField();
    const saved = save("assessment_tools_questions", funds);
    useTemplateSync.getState().markDirty("assessment_tools_questions");
    finish({
      data: { field: "assessment_tools_questions", value: funds, edit },
    });
    expect(await saved).toBe(true);
    expect(useStore.getState().jsonData.assessment_tools_questions).toEqual(
      funds
    );
    expect(
      useTemplateSync.getState().dirty.assessment_tools_questions
    ).toBeDefined();
    const next = {
      ...funds,
      controlQuestions: "Дополненный контрольный вопрос",
    };
    vi.mocked(axiosBase.put).mockResolvedValueOnce({
      data: { field: "assessment_tools_questions", value: next, edit },
    });
    expect(await save("assessment_tools_questions", next)).toBe(true);
    expect(axiosBase.put).toHaveBeenLastCalledWith("update-json-value/12", {
      fieldToUpdate: "assessment_tools_questions",
      value: next,
      baseAt: after,
    });
    expect(useTemplateSync.getState().dirty).toEqual({});
  });
});
