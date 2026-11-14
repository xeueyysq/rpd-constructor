// Проверено 2026-11-05: официальный гид университета 2024, стр. 11–12.
// https://cms.uni-dubna.ru/api/assets/uni-dubna/ee766717-7006-4dde-ac0d-a914ee5d8414/gid-pervokursnika-2024-3-.pdf?version=0
const departmentsByInstitute: Record<string, string[]> = {
  "Институт системного анализа и управления": [
    "Интеллектуального управления техническими системами",
    "Информационных технологий",
    "Распределенных информационно-вычислительных систем",
    "Системного анализа и управления",
    "Цифровой экономики и управления",
    "Геоинформационных систем и технологий",
  ],
  "Инженерно физический институт": [
    "Фундаментальных проблем физики микромира",
    "Ядерной физики",
    "Физико-технических систем",
    "Проектирования электроники для установок «мегасайенс»",
  ],
  "Факультет естественных и инженерных наук": [
    "Биофизики",
    "Нанотехнологий и новых материалов",
    "Общей и прикладной геофизики",
    // Химия → ФЕИН также подтверждена изданиями библиотеки 2026 года:
    // https://lib.uni-dubna.ru/biblweb/expo/exposition.asp?exid=1025
    "Химии, новых технологий и материалов",
    "Экологии и наук о Земле",
  ],
  "Факультет социальных и гуманитарных наук": [
    "Клинической психологии",
    "Лингвистики",
    "Психологии",
    "Социологии и гуманитарных наук",
    "Юриспруденции",
  ],
};

// Только ключ сравнения подразделений; названия направлений и профилей не меняет.
const normalizeSubdivisionName = (value: unknown) => typeof value === "string"
  ? value.toLowerCase()
    .replace(/[«»„“”"'‘’]/gu, "")
    .replace(/\s*\(\s*вып\.\s*фак\.\s*\)\s*$/u, "")
    .replace(/(?<=\p{L})\s*[-‐‑‒–—]\s*(?=\p{L})/gu, " ")
    .trim().replace(/\s+/g, " ")
  : "";

const instituteByDepartment = new Map(
  Object.entries(departmentsByInstitute).flatMap(([institute, departments]) =>
    departments.map(department => [normalizeSubdivisionName(department), institute] as const)
  )
);

const resolveDepartmentInstitute = (chairName: unknown) =>
  instituteByDepartment.get(normalizeSubdivisionName(chairName).replace(/^кафедра\s+/u, "")) ?? null;

export { normalizeSubdivisionName, resolveDepartmentInstitute };
