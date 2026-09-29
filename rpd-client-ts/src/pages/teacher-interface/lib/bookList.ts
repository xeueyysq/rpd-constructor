export function addBooks(current: string[], added: string[]): string[] {
  const seen = new Set(current.map((book) => book.trim()));
  const next = [...current];
  for (const book of added) {
    const trimmed = book.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next.length === current.length ? current : next;
}
