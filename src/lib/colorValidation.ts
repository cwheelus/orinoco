/**
 * Cross-checks colors.csv overrides against the classes actually
 * present in the loaded dataset. Deliberately separate from
 * classColors.ts (which only ever resolves ONE class's color and has
 * no concept of "the dataset" at all) — this is dataset-aware
 * validation, a different responsibility. See #59.
 */
export function getUnmatchedColorOverrides(
  overrides: Record<string, string>,
  availableClasses: string[],
): string[] {
  const available = new Set(availableClasses);
  return Object.keys(overrides).filter((cls) => !available.has(cls));
}
