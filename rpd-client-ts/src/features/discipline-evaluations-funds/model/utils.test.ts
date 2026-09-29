import { describe, expect, it } from "vitest";
import { normalizeFunds } from "./utils";

describe("normalizeFunds", () => {
  it("сохраняет снятый выбор всех вопросов", () => {
    const data = normalizeFunds(
      {
        controlQuestions: "",
        competencies: {
          "УК-1": {
            openQuestions: "",
            closedQuestions: "",
            openPool: [{ id: "q1", text: "Вопрос" }],
            closedPool: [],
            selectedOpenIds: [],
            selectedClosedIds: [],
          },
        },
      },
      [{ competence: "УК-1" }]
    );

    expect(data.competencies["УК-1"].selectedOpenIds).toEqual([]);
    expect(data.competencies["УК-1"].openQuestions).toBe("");
  });
});
