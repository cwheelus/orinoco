/**
 * Display-layer label truncation, per Charles/Eric's agreed spec
 * (Slack, #59):
 *   - <= maxLength: unchanged
 *   - Contains `_` or `-`: split on the FIRST separator, each side
 *     gets floor(maxLength/2) characters. The separator is NOT
 *     counted against that budget — it's an 8-character CONTENT
 *     budget, not a hard cap on total rendered length.
 *     e.g. "marketing_sales" -> "mark_sale" (9 rendered characters
 *     when maxLength=8: 4 + separator + 4)
 *   - No separator: hard truncate to maxLength.
 *
 * This is a DISPLAY-ONLY transform. The underlying data (axisLabels,
 * class names) is never modified — callers are expected to also
 * expose the untruncated original (e.g. via a hover/title). See #59.
 */
export function truncateLabel(name: string, maxLength = 8): string {
  if (name.length <= maxLength) return name;

  const separatorIndex = name.search(/[_-]/);
  if (separatorIndex === -1) {
    return name.slice(0, maxLength);
  }

  const separator = name[separatorIndex];
  const before = name.slice(0, separatorIndex);
  const after = name.slice(separatorIndex + 1);

  const half = Math.floor(maxLength / 2);
  return before.slice(0, half) + separator + after.slice(0, half);
}
