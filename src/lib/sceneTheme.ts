export type ThemeName = "dark" | "light";

export interface SceneTheme {
  scene: {
    axis: string;
    tick: string;
    gridMajor: string;
    gridMinor: string;
    outline: string;
  };
  text: {
    title: string;
    label: string;
  };
  interaction: {
    selection: string;
    hover: string;
    pivot: string;
  };
}

export const sceneTheme: Record<ThemeName, SceneTheme> = {
  dark: {
    scene: {
      axis: "#b8c2d6",
      tick: "#8899b0",
      gridMajor: "#475569",
      gridMinor: "#1e293b",
      outline: "#64748b",
    },
    text: {
      title: "#ffffff",
      label: "#cccccc",
    },
    interaction: {
      selection: "#38bdf8",
      hover: "#60a5fa",
      pivot: "#22c55e",
    },
  },
  light: {
    scene: {
      axis: "#475569",
      tick: "#64748b",
      gridMajor: "#94a3b8",
      gridMinor: "#e2e8f0",
      outline: "#cbd5e1",
    },
    text: {
      title: "#0f172a",
      label: "#334155",
    },
    interaction: {
      selection: "#0284c7",
      hover: "#2563eb",
      pivot: "#16a34a",
    },
  },
};

// Sub-namespace type exports for targeted utility signatures
export type SceneColors = SceneTheme["scene"];
export type TextColors = SceneTheme["text"];
export type InteractionColors = SceneTheme["interaction"];

/**
 * Pure, side-effect-free theme resolver.
 * Direct lookup strictly typed against ThemeName keys.
 */
export function getSceneTheme(theme: ThemeName): SceneTheme {
  return sceneTheme[theme];
}
