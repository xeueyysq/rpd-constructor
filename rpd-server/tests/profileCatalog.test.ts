import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import axios from "axios";
import type { Pool } from "pg";
import { syncAndGetSpecProfiles } from "../app/modules/1cExchange.ts";

type Tree = Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, number>>>>>>;
const catalog = JSON.parse(readFileSync(new URL("../app/data/json_profiles.json", import.meta.url), "utf8")) as Tree;
const approved = JSON.parse(readFileSync(new URL("./fixtures/profiles-reference-2026.json", import.meta.url), "utf8")) as { rows: string[][] };
const institutes: Record<string, string> = {
  ИСАУ: "Институт системного анализа и управления",
  ИФИ: "Инженерно физический институт",
  ФСГН: "Факультет социальных и гуманитарных наук",
};
const levels: Record<string, string> = { "03": "Бакалавриат", "04": "Магистратура", "05": "Специалитет" };
const forms: Record<string, string> = { очная: "Очная", заочная: "Заочная", "очно-заочная": "Очно-заочная" };
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

function leaves(tree: Tree) {
  return Object.entries(tree).flatMap(([institute, levelNodes]) =>
    Object.entries(levelNodes).flatMap(([level, directionNodes]) =>
      Object.entries(directionNodes).flatMap(([direction, profileNodes]) =>
        Object.entries(profileNodes).flatMap(([profile, formNodes]) =>
          Object.keys(formNodes).map((form) => [institute, level, direction, profile, form].join("|"))
        )
      )
    )
  );
}

test("справочник содержит все утверждённые B:E пути, три формы и прежние профили", () => {
  const actual = new Set(leaves(catalog));
  const expected = new Set(approved.rows.map(([institute, direction, profile, form]) => {
    const canonicalDirection = normalize(direction);
    const level = levels[canonicalDirection.split(" ")[0].split(".")[1]];
    return [institutes[normalize(institute)], level, canonicalDirection, normalize(profile), forms[normalize(form).toLowerCase()]].join("|");
  }));

  assert.equal(approved.rows.length, 69);
  assert.equal(expected.size, 68); // одна точная повторная строка эталона
  assert.equal(actual.size, 83); // 27 исходных путей + 56 новых
  for (const path of expected) assert.ok(actual.has(path), path);
  for (const path of [
    "Институт системного анализа и управления|Бакалавриат|01.03.02 Прикладная математика и информатика|Математическое моделирование|Очная",
    "Институт системного анализа и управления|Бакалавриат|38.03.05 Бизнес-информатика|Электронный бизнес|Очная",
    "Институт системного анализа и управления|Аспирантура|09.06.01 Информатика и вычислительная техника|Системный анализ, управление и обработка информации|Очная",
  ]) assert.ok(actual.has(path), path);
  for (const path of actual) {
    const [institute, level, direction, profile, form] = path.split("|");
    assert.deepEqual(Object.values(catalog[institute][level][direction][profile][form]), [2026, 2025, 2024, 2023, 2022]);
  }
});

test("при отказе 1С сохранённые сырые данные соединяются с обновлённым справочником", async (t) => {
  t.mock.method(axios, "get", async () => { throw new Error("1С недоступна"); });
  const database = {
    query: async () => ({ rows: [{
      tree_payload: { Устаревший: {} },
      raw_payload: [{
        specialisation: { code: "99.03.01", name: "Новая программа 1С" },
        profiles: [{ name: "Профиль 1С", chair: { name: institutes.ИСАУ } }],
      }],
    }] }),
  } as unknown as Pool;
  const result = await syncAndGetSpecProfiles(database);
  assert.equal(result.source, "database");
  const tree = result.tree as Tree;
  assert.ok(tree[institutes.ИСАУ].Бакалавриат["09.03.01 Информатика и вычислительная техника"].ЦОД.Очная);
  assert.ok(tree[institutes.ИСАУ].Бакалавриат["99.03.01 Новая программа 1С"]["Профиль 1С"].Очная);
  assert.equal(Object.hasOwn(tree, "Устаревший"), false);
});
