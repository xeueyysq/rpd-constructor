import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { hashPayload, merge1cIntoReferenceTree } from "../app/modules/specProfilesTransformer.ts";

const ISAU = "Институт системного анализа и управления";
const IFI = "Инженерно физический институт";
const FSGN = "Факультет социальных и гуманитарных наук";
const FEIN = "Факультет естественных и инженерных наук";
const reference = JSON.parse(readFileSync(new URL("../app/data/json_profiles.json", import.meta.url), "utf8")) as Record<string, unknown>;

const nodeAt = (tree: unknown, path: string[]): unknown => {
  let node = tree;
  for (const key of path) {
    if (!node || typeof node !== "object" || !Object.hasOwn(node, key)) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
};

const profilePaths = (tree: unknown): string[][] => {
  const paths: string[][] = [];
  const visit = (node: unknown, path: string[]) => {
    if (path.length === 4) {
      paths.push(path);
    } else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) visit(value, [...path, key]);
    }
  };
  visit(tree, []);
  return paths;
};

// Компактные выдержки GetAllSpecProfiles: имена и строковые ID сохранены.
const chemistry = {
  specialisation: { id: "388     ", code: "04.06.01", name: "Химические науки" },
  profiles: [
    { id: "0000000117", name: "Физическая химия", chair: { id: "000000011", name: FEIN } },
    { id: "0000000117", name: "Физическая химия", chair: { id: "216", name: "Кафедра химии, новых технологий и материалов" } },
    { id: "0000000120", name: "Аналитическая химия", chair: { id: "216", name: "Кафедра химии, новых технологий и материалов" } },
  ],
};
const law = {
  specialisation: { id: "266", code: "40.03.01", name: "Юриспруденция" },
  profiles: [
    { id: "0000000032", name: "Гражданско-правовой", chair: { id: "204", name: "Факультет социальных и гуманитарных наук (вып.фак.)" } },
    { id: "0000000055", name: "Уголовно-правовой", chair: { id: "204", name: "Факультет социальных и гуманитарных наук (вып.фак.)" } },
  ],
};
const physics = {
  specialisation: { id: "427     ", code: "03.06.01", name: "Физика и астрономия" },
  profiles: [{ id: "0000000180", name: "Теоретическая физика", chair: { id: "000000565", name: "Инженерно-физический институт" } }],
};
const management = {
  specialisation: { id: "268", code: "38.03.04", name: "Государственное и муниципальное управление" },
  profiles: [
    { id: "0000000131", name: "Муниципальное управление и бизнес", chair: { id: "000000030", name: "Кафедра социологии и гуманитарных наук" } },
    { id: "0000000131", name: "Муниципальное управление и бизнес", chair: { id: "204", name: "Факультет социальных и гуманитарных наук (вып.фак.)" } },
    { id: "0000000037", name: "Муниципальное управление", chair: { id: "208", name: "Кафедра цифровой экономики и управления" } },
    { id: "0000000131", name: "Муниципальное управление и бизнес", chair: { id: "208", name: "Кафедра цифровой экономики и управления" } },
    { id: "0000000131", name: "Муниципальное управление и бизнес", chair: { id: "209", name: "Кафедра геоинформатики" } },
    { id: "0000000131", name: "Муниципальное управление и бизнес", chair: { id: "218", name: "Инженерно-физический институт (вып.фак.)" } },
  ],
};

for (const { title, input, expected } of [
  { title: "аналитическую химию через подтверждённую кафедру", input: chemistry, expected: [[FEIN, "Специалитет", "04.06.01 Химические науки", "Аналитическая химия"]] },
  { title: "оба правовых профиля через вып.фак.", input: law, expected: [
    [FSGN, "Бакалавриат", "40.03.01 Юриспруденция", "Гражданско-правовой"],
    [FSGN, "Бакалавриат", "40.03.01 Юриспруденция", "Уголовно-правовой"],
  ] },
  { title: "теоретическую физику под старым каноническим именем ИФИ", input: physics, expected: [[IFI, "Специалитет", "03.06.01 Физика и астрономия", "Теоретическая физика"]] },
]) {
  test(`merge добавляет ${title}`, () => {
    const tree = merge1cIntoReferenceTree([input]);
    for (const path of expected) assert.ok(nodeAt(tree, [...path, "Очная"]), path.join(" → "));
  });
}

test("подтверждённые кафедры остальных групп разрешаются по названию", () => {
  const tree = merge1cIntoReferenceTree([
    {
      specialisation: { id: "195", code: "09.03.01", name: "Информатика и вычислительная техника" },
      profiles: [{ id: "0000000082", name: "Программное обеспечение вычислительной техники и автоматизированных систем", chair: { id: "000000057", name: "Информационных технологий" } }],
    },
    {
      specialisation: { id: "409     ", code: "09.06.01", name: "Информатика и вычислительная техника" },
      profiles: [{ id: "0000000142", name: "ИВТ_ПЭ_ОИ", chair: { id: "217", name: "Кафедра проектирования электроники для установок «мегасайенс»" } }],
    },
    {
      specialisation: { id: "391     ", code: "37.06.01", name: "Психологические науки" },
      profiles: [{ id: "0000000156", name: "Педагогическая психология в образовании", chair: { id: "210", name: "Кафедра клинической психологии" } }],
    },
  ]);
  for (const path of [
    [ISAU, "Бакалавриат", "09.03.01 Информатика и вычислительная техника", "Программное обеспечение вычислительной техники и автоматизированных систем"],
    [IFI, "Специалитет", "09.06.01 Информатика и вычислительная техника", "ИВТ_ПЭ_ОИ"],
    [FSGN, "Специалитет", "37.06.01 Психологические науки", "Педагогическая психология в образовании"],
  ]) assert.ok(nodeAt(tree, [...path, "Очная"]), path.join(" → "));
});

test("для сравнения подразделений допускает регистр, пробелы, кавычки, дефисы и префикс Кафедра", () => {
  const tree = merge1cIntoReferenceTree([
    { ...physics, profiles: [{ name: "Теоретическая физика", chair: { name: "  «ИНЖЕНЕРНО — ФИЗИЧЕСКИЙ  ИНСТИТУТ» ( вып. фак. ) " } }] },
    { ...chemistry, profiles: [{ name: "Аналитическая химия", chair: { name: " ХИМИИ, НОВЫХ ТЕХНОЛОГИЙ И МАТЕРИАЛОВ " } }] },
  ]);
  assert.ok(nodeAt(tree, [IFI, "Специалитет", "03.06.01 Физика и астрономия", "Теоретическая физика", "Очная"]));
  assert.ok(nodeAt(tree, [FEIN, "Специалитет", "04.06.01 Химические науки", "Аналитическая химия", "Очная"]));
  assert.deepEqual(Object.keys(tree), [ISAU, IFI, FSGN, FEIN]);
});

test("две прямые привязки профиля приоритетны; другие профили кафедры не наследуют их", () => {
  const profileName = "Синтетический профиль прямой привязки";
  const direct = management.profiles.filter(p => ["204", "218"].includes(p.chair.id));
  const departments = management.profiles.filter(p => !["204", "218"].includes(p.chair.id));
  const tree = merge1cIntoReferenceTree([
    { specialisation: { ...management.specialisation, id: " 268 " }, profiles: direct.map(p => ({ ...p, id: " 0000000131 ", name: profileName })) },
    { ...management, profiles: departments.map(p => p.id === "0000000131" ? { ...p, name: profileName } : p) },
  ]);
  const owners = profilePaths(tree).filter(path => path[3] === profileName).map(path => path[0]).sort();
  assert.deepEqual(owners, [IFI, FSGN].sort());
  assert.ok(nodeAt(tree, [ISAU, "Бакалавриат", "38.03.04 Государственное и муниципальное управление", "Муниципальное управление", "Очная"]));
  assert.equal(nodeAt(tree, [FSGN, "Бакалавриат", "38.03.04 Государственное и муниципальное управление", "Муниципальное управление"]), undefined);
});

test("приоритет прямой записи требует полной строковой identity и того же кода", () => {
  const direct = { ...management, profiles: [management.profiles[1]] };
  const department = management.profiles[3];
  for (const [specialisationId, profileId, code] of [
    ["0268", "0000000131", "38.03.04"],
    ["268", "131", "38.03.04"],
    ["268", "0000000131", "38.04.04"],
    [268, "0000000131", "38.03.04"],
    ["268", 131, "38.03.04"],
    [" ", "0000000131", "38.03.04"],
    ["268", " ", "38.03.04"],
    [undefined, "0000000131", "38.03.04"],
    ["268", undefined, "38.03.04"],
  ] as const) {
    const tree = merge1cIntoReferenceTree([direct, {
      specialisation: { ...management.specialisation, id: specialisationId, code },
      profiles: [{ ...department, id: profileId }],
    }]);
    assert.ok(nodeAt(tree, [ISAU, code === "38.04.04" ? "Магистратура" : "Бакалавриат", `${code} Государственное и муниципальное управление`, "Муниципальное управление и бизнес", "Очная"]));
  }
});

test("неизвестные подразделения и неподтверждённые грамматические варианты не распределяются", () => {
  const tree = merge1cIntoReferenceTree([{
    specialisation: { id: "397     ", code: "05.06.01", name: "Науки о Земле" },
    profiles: [
      "Университет Дубна", 'Технологический институт "Протвино"', "ДИНО", "Протвино",
      "Кафедра геоинформатики", "Кафедра экологии и науки о Земле", "Кафедра физико-технические системы",
      "Кафедра «Интеллектуальное управление техническими системами»", "Кафедра социальной работы",
      "Центр дистанционного и заочного образования", "Неизвестная кафедра",
    ].map(name => ({ id: "0000000118", name: "Геоэкология", chair: { name } })),
  }]);
  assert.deepEqual(tree, reference);
});

test("сохраняет весь справочник и его канонические названия направлений и профилей", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2025-06-01T12:00:00Z") });
  const tree = merge1cIntoReferenceTree([
    {
      specialisation: { code: "09.03.01", name: "Иное название от 1С" },
      profiles: [{ name: "  технологии разработки ПРОГРАММНОГО обеспечения ", chair: { name: ISAU } }],
    },
    {
      specialisation: { id: "213", code: "01.03.02", name: "Прикладная математика и информатика" },
      profiles: [{ id: "0000000030", name: "Математическое моделирование", chair: { id: "203", name: "Кафедра распределенных информационно-вычислительных систем" } }],
    },
  ]);
  assert.deepEqual(tree, reference);
});

test("новые листья сохраняют Очную форму и прежние пять годовых слотов", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-05T12:00:00Z") });
  const tree = merge1cIntoReferenceTree([chemistry]);
  assert.deepEqual(nodeAt(tree, [FEIN, "Специалитет", "04.06.01 Химические науки", "Аналитическая химия"]), {
    "Очная": { "0": 2027, "1": 2026, "2": 2025, "3": 2024, "4": 2023 },
  });
  for (const path of profilePaths(reference)) assert.deepEqual(nodeAt(tree, path), nodeAt(reference, path));
});

test("порядок и повторы не меняют дерево и хеш; вход остаётся неизменным", () => {
  const input = [chemistry, law, physics, management];
  const original = structuredClone(input);
  const tree = merge1cIntoReferenceTree(input);
  const permuted = input.toReversed().map(row => ({ ...row, profiles: row.profiles.toReversed() }));
  const repeated = merge1cIntoReferenceTree([...permuted, ...input]);
  assert.deepEqual(repeated, tree);
  assert.equal(hashPayload(repeated), hashPayload(tree));
  assert.deepEqual(input, original);
});

test("повреждённые записи пропускаются до строковых преобразований и не мешают соседним", () => {
  const profile = { name: "Проверка валидного соседа", chair: { name: FEIN } };
  const valid = { specialisation: { code: "99.03.01", name: "Проверка входа" }, profiles: [profile] };
  const tree = merge1cIntoReferenceTree([
    null, false, 42, [], "мусор", {},
    { ...valid, specialisation: null },
    { ...valid, specialisation: [] },
    { ...valid, specialisation: { code: "garbage.03", name: "Мусорный код" } },
    ...[undefined, null, 42, {}, [], { toString: null }, " "].map(name => ({ ...valid, specialisation: { code: "99.03.01", name } })),
    ...[null, {}, "мусор"].map(profiles => ({ ...valid, profiles })),
    { ...valid, profiles: [null, false, "мусор", {}, { ...profile, name: {} }, { ...profile, chair: [] }, { ...profile, chair: { name: {} } }, profile] },
    valid,
  ]);
  const existing = new Set(profilePaths(reference).map(path => JSON.stringify(path)));
  assert.deepEqual(profilePaths(tree).filter(path => !existing.has(JSON.stringify(path))), [
    [FEIN, "Бакалавриат", "99.03.01 Проверка входа", "Проверка валидного соседа"],
  ]);
  for (const raw of [undefined, null, {}, 42, "мусор"]) assert.deepEqual(merge1cIntoReferenceTree(raw), reference);
});

test("внешнее имя __proto__ не загрязняет Object.prototype и не теряет валидный профиль", () => {
  const before = Object.getOwnPropertyDescriptors(Object.prototype);
  try {
    const tree = merge1cIntoReferenceTree([{
      specialisation: { code: "99.03.01", name: "Проверка безопасности" },
      profiles: ["__proto__", "constructor", "prototype", "Валидный профиль"].map(name => ({ name, chair: { name: FEIN } })),
    }]);
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), before);
    assert.ok(nodeAt(tree, [FEIN, "Бакалавриат", "99.03.01 Проверка безопасности", "Валидный профиль", "Очная"]));
    assert.doesNotThrow(() => JSON.stringify(tree));
  } finally {
    for (const key of Reflect.ownKeys(Object.prototype)) {
      if (!Object.hasOwn(before, key)) Reflect.deleteProperty(Object.prototype, key);
    }
  }
});
