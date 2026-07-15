// Single source of truth for classification -> display color, shared by
// PointCloud.tsx (sphere material color) and App.tsx (HUD classification
// text + legend swatches) — previously these hardcoded separate copies of
// the same mapping, which drifted out of sync when the real class values
// changed (see flow-viz-sample1.csv: normal/nss/qc/zt, not the original
// spec's unknown/attack/normal).
export const classColors: Record<string, string> = {
  normal: "#dddddd",
  nss: "#dd0000",
  qc: "#00dd00",
  zt: "#0000dd",
};

// Fallback for any class value not in the map above (e.g. a future
// category the color scheme hasn't been updated for yet).
export const DEFAULT_CLASS_COLOR = "#ffffff";
