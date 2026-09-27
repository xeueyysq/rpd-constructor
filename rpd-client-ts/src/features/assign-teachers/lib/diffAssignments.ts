export function diffAssignments(previous: number[], next: number[]) {
  const previousIds = new Set(previous);
  const nextIds = new Set(next);
  return {
    assign: next.filter((id) => !previousIds.has(id)),
    unassign: previous.filter((id) => !nextIds.has(id)),
  };
}
