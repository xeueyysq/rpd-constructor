// Только отображение: исходное название остаётся ключом импорта и синхронизации.
export function formatDisciplineName(name: string): string;
export function formatDisciplineName(name: string | null): string | null;
export function formatDisciplineName(name: string | null | undefined): string | null | undefined;
export function formatDisciplineName(name: string | null | undefined): string | null | undefined {
  if (!name || name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
