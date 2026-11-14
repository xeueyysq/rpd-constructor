import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type Years = Record<string, number>;
type Catalog = Record<string, Record<string, Record<string, Record<string, Record<string, Years>>>>>;
type SourceEntry = {
  specialisation: { code: string; name: string };
  profiles: { name: string }[];
};
type Path = [institute: string, level: string, direction: string, profile: string, form: string];

const server = JSON.parse(readFileSync(new URL("../app/data/json_profiles.json", import.meta.url), "utf8")) as Catalog;
const client = JSON.parse(readFileSync(new URL("../../rpd-client-ts/public/json_profiles.json", import.meta.url), "utf8")) as Catalog;
const source = JSON.parse(readFileSync(new URL("./fixtures/profiles-1c-2026-11-13.json", import.meta.url), "utf8")) as SourceEntry[];
const approved = JSON.parse(readFileSync(new URL("./fixtures/profiles-reference-2026.json", import.meta.url), "utf8")) as { rows: string[][] };

const sourceByCode = new Map(source.map(({ specialisation, profiles }) => [specialisation.code, { direction: specialisation.name, profiles: profiles.map(({ name }) => name) }]));
const instituteNames: Record<string, string> = {
  ИСАУ: "Институт системного анализа и управления",
  ИФИ: "Инженерно физический институт",
  ФСГН: "Факультет социальных и гуманитарных наук",
};
const levels: Record<string, string> = { "03": "Бакалавриат", "04": "Магистратура", "05": "Специалитет" };
const forms: Record<string, string> = { очная: "Очная", заочная: "Заочная", "очно-заочная": "Очно-заочная" };
const confirmedCorrections: Record<string, string> = {
  "Муниципальное управление и бизне": "Муниципальное управление и бизнес",
  "Бизнес-аналитика и интеллектуальный аналих данных": "Бизнес-аналитика и интеллектуальный анализ данных",
};
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
const key = (path: Path) => JSON.stringify(path);

// Пять согласованных исключений сохраняют прежние названия, формы и годы.
// Их совместимость с GetDisciplinesByPlan по сохранённому ответу 1С не подтверждена.
const exceptions = new Set([
  ["Институт системного анализа и управления", "Бакалавриат", "09.03.01 Информатика и вычислительная техника", "ЦОД", "Очная"],
  ["Институт системного анализа и управления", "Аспирантура", "09.06.01 Информатика и вычислительная техника", "Системный анализ, управление и обработка информации", "Очная"],
  ["Институт системного анализа и управления", "Аспирантура", "09.06.01 Информатика и вычислительная техника", "Системный анализ, управление и обработка информации (радиоэлектроника)", "Очная"],
  ["Институт системного анализа и управления", "Аспирантура", "09.06.01 Информатика и вычислительная техника", "Математическое моделирование, численные методы и комплексы программ", "Очная"],
  ["Институт системного анализа и управления", "Аспирантура", "38.06.01 Экономика ", "Экономика и управление народным хозяйством. Управление инновациями", "Очная"],
].map((path) => key(path as Path)));

function leaves(tree: Catalog): Path[] {
  return Object.entries(tree).flatMap(([institute, levelNodes]) =>
    Object.entries(levelNodes).flatMap(([level, directionNodes]) =>
      Object.entries(directionNodes).flatMap(([direction, profileNodes]) =>
        Object.entries(profileNodes).flatMap(([profile, formNodes]) =>
          Object.keys(formNodes).map((form) => [institute, level, direction, profile, form] as Path)
        )
      )
    )
  );
}

test("серверный и клиентский каталоги содержат одинаковые пути и годы", () => {
  assert.deepEqual(client, server);
});

test("все подтверждённые пути используют дословные названия из сохранённого ответа 1С", () => {
  const paths = leaves(server);
  assert.equal(paths.length, 83);
  assert.equal(exceptions.size, 5);
  for (const path of paths) {
    const [institute, level, direction, profile, form] = path;
    assert.deepEqual(Object.values(server[institute][level][direction][profile][form]), [2026, 2025, 2024, 2023, 2022], key(path));
    if (exceptions.has(key(path))) continue;
    const [code, ...name] = direction.split(" ");
    const entry = sourceByCode.get(code);
    assert.ok(entry, key(path));
    assert.equal(name.join(" "), entry.direction, key(path));
    assert.ok(entry.profiles.includes(profile), key(path));
  }
  for (const exception of exceptions) assert.ok(paths.some((path) => key(path) === exception), exception);
});

test("утверждённые формы присутствуют под подтверждёнными именами 1С", () => {
  const actual = new Set(leaves(server).map(key));
  const expected = new Set<string>();
  for (const [shortInstitute, originalDirection, originalProfile, originalForm] of approved.rows) {
    const code = normalize(originalDirection).split(" ")[0];
    const level = levels[code.split(".")[1]];
    const institute = instituteNames[normalize(shortInstitute)];
    const form = forms[normalize(originalForm).toLowerCase()];
    assert.ok(level && institute && form);
    const entry = sourceByCode.get(code);
    assert.ok(entry, code);
    const normalizedProfile = confirmedCorrections[normalize(originalProfile)] ?? normalize(originalProfile);
    const matches = [...new Set(entry.profiles.filter((name) => normalize(name) === normalizedProfile))];
    if (normalizedProfile === "ЦОД") {
      const exception = key([institute, level, `${code} ${entry.direction}`, "ЦОД", form]);
      assert.ok(exceptions.has(exception));
      continue;
    }
    assert.equal(matches.length, 1, `${code} ${originalProfile}`);
    expected.add(key([institute, level, `${code} ${entry.direction}`, matches[0], form]));
  }
  assert.equal(approved.rows.length, 69);
  assert.equal(expected.size, 67); // одна повторная строка и одно согласованное исключение «ЦОД»
  for (const path of expected) assert.ok(actual.has(path), path);
});
