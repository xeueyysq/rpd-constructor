import { describe, expect, it } from "vitest";
import {
  ATTESTATION_ROW_ID,
  changedPlanHours,
  contentForDisplay,
  contentForSave,
  emptyPlan,
  validContentDraft,
} from "./contentDraft";

const row = {
  theme: "Тема",
  lectures: 2,
  seminars: 0,
  independent_work: 1,
  competence: "УК-1",
  indicator: "И-1",
  results: "Результат",
  importedMetadata: { id: "external-42" },
};

describe("черновик содержания", () => {
  it("не сохраняет автоматически добавленную аттестацию и сохраняет ID/неизвестные поля при правке темы", () => {
    const baseline = { "source-id": row };
    const display = contentForDisplay(
      baseline,
      "Промежуточная аттестация: зачёт",
      4
    );
    expect(contentForSave(display, display, baseline)).toEqual(baseline);
    const draft = { ...display, "source-id": { ...row, theme: "Новая тема" } };
    expect(contentForSave(draft, display, baseline)).toEqual({
      "source-id": { ...row, theme: "Новая тема" },
    });
  });

  it("сохраняет метаданные аттестации и явно изменённый контроль", () => {
    const attestation = { ...row, theme: "Старое название", control: 4 };
    const baseline = { [ATTESTATION_ROW_ID]: attestation };
    const display = contentForDisplay(
      baseline,
      "Промежуточная аттестация: экзамен",
      8
    );
    expect(contentForSave(display, display, baseline)).toEqual(baseline);
    expect(
      contentForSave(
        {
          ...display,
          [ATTESTATION_ROW_ID]: { ...display[ATTESTATION_ROW_ID], control: 0 },
        },
        display,
        baseline
      )
    ).toEqual({
      [ATTESTATION_ROW_ID]: {
        ...attestation,
        theme: "Промежуточная аттестация: экзамен",
        control: 0,
      },
    });
  });

  it("готовит только изменённые часы и отклоняет весь draft до записи при недопустимом числе", () => {
    const hours = changedPlanHours(
      { ...emptyPlan, lectures: 3, seminars: 2, contact: 5 },
      emptyPlan
    );
    expect(hours).toEqual({ lectures: 3, seminars: 2 });
    expect(changedPlanHours(emptyPlan, emptyPlan)).toEqual({});
    expect(validContentDraft({ a: row }, hours)).toBe(true);
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validContentDraft({ a: { ...row, lectures: invalid } }, hours)
      ).toBe(false);
      expect(validContentDraft({ a: row }, { all: invalid })).toBe(false);
    }
  });
});
