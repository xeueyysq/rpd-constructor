export type FundsQuestion = { text: string; answer: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function competencies(funds: unknown): Record<string, unknown> | null {
  return record(record(funds)?.competencies);
}

export function fundsCompetences(funds: unknown): string[] {
  const entries = competencies(funds);
  return entries ? Object.keys(entries).filter((name) => name.trim() && record(entries[name])) : [];
}

function legacyQuestions(value: unknown): Array<FundsQuestion & { id: string }> {
  return typeof value === "string"
    ? value.split(/\r?\n+/).map((text) => text.trim()).filter(Boolean).map((text, index) => ({ id: `legacy_${index}`, text, answer: "" }))
    : [];
}

function selectedQuestions(item: Record<string, unknown>, kind: "open" | "closed"): FundsQuestion[] {
  const pool = item[`${kind}Pool`];
  const selectedValue = item[kind === "open" ? "selectedOpenIds" : "selectedClosedIds"];
  const selected = Array.isArray(selectedValue) ? new Set(selectedValue.filter((id): id is string => typeof id === "string")) : null;
  if (!Array.isArray(pool) || pool.length === 0) return legacyQuestions(item[`${kind}Questions`])
    .filter((question) => !selected || selected.has(question.id))
    .map(({ text, answer }) => ({ text, answer }));
  return pool.flatMap((value: unknown) => {
    const question = record(value);
    if (!question || typeof question.id !== "string" || typeof question.text !== "string" || !question.text.trim() || selected && !selected.has(question.id)) return [];
    return [{ text: question.text, answer: typeof question.correctAnswer === "string" ? question.correctAnswer : "" }];
  });
}

export function selectedFundsQuestions(funds: unknown, competence: string): { open: FundsQuestion[]; closed: FundsQuestion[] } {
  const item = record(competencies(funds)?.[competence]);
  return item ? { open: selectedQuestions(item, "open"), closed: selectedQuestions(item, "closed") } : { open: [], closed: [] };
}
