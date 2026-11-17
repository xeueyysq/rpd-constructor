import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";

for (const { name, saved, edits, expected } of [
  { name: "новая РПД", saved: null, edits: {}, expected: "Экзамен + курсовая работа" },
  { name: "системная форма", saved: "Курсовая работа", edits: { certification: { userId: null, at: "2026-01-01T00:00:00Z" } }, expected: "Экзамен + курсовая работа" },
  { name: "ручная форма", saved: "Индивидуальная форма", edits: { certification: { userId: 7, at: "2026-01-01T00:00:00Z" } }, expected: "Индивидуальная форма" },
  { name: "форма без истории", saved: "Зачет", edits: {}, expected: "Зачет" },
] as const) {
  test(`чтение ${name} возвращает действующую аттестацию в модели РПД`, async () => {
    const db = { query: async (sql: string) => {
      if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
      if (sql.includes("FROM rpd_profile_templates rpt")) return { rows: [{
        id: 12, disciplins_name: "Программирование", certification: saved, field_edits: edits,
        study_load: { "Лекции": 36 }, control_load: { "Курсовая работа": 0, "Экзамен": 36 },
      }] };
      return { rows: [] };
    } } as unknown as Pool;
    const profile = await new RpdProfileTemplates(db).getJsonProfile(12);
    assert.equal(profile?.certification, expected);
  });
}
