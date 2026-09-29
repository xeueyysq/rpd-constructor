export function formatProgress(progress: {
  done: number;
  total: number;
}): string {
  return `${progress.done}/${progress.total} готовы`;
}
