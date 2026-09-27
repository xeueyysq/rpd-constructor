function stableJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, current: unknown) => {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      return current;
    return Object.fromEntries(
      Object.entries(current).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0
      )
    );
  });
}

export function sameValue(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}
