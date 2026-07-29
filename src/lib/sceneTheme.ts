/**
 * Centralized WebGL / Three.js color tokens.
 *
 * Architecture Note:
 * Unlike Tailwind CSS theme tokens (which style DOM elements via CSS variables/classes),
 * these values are consumed directly by Three.js materials, `@react-three/drei` primitives
 * (<Text />, <Line />, etc.), custom meshes, and shader uniforms.
 *
 * Usage Guidance:
 * - React components in the R3F scene tree should consume theme colors via `useSceneTheme()`.
 * - Non-React callers (web workers, canvas image exporters, headless rendering) should call `getSceneTheme(themeName)`.
 *
 * Extension Guide:
 * To add a new theme (e.g., "highContrast"):
 * 1. Add key to `BuiltInTheme` union.
 * 2. Implement palette under `sceneTheme` registry.
 * 3. TypeScript will enforce full `SceneTheme` structure automatically.
 */

/**
 * Union of explicitly supported built-in scene themes.
 * Prevents accidental keys from being introduced into `sceneTheme`.
 */
type BuiltInTheme = "dark" | "light";

/**
 * Color palette dedicated to spatial grid geometry and reference frame meshes.
 */
export interface SceneColors {
  readonly axis: string;
  readonly tick: string;
  readonly gridMajor: string;
  readonly gridMinor: string;
  readonly outline: string;
}

/**
 * Color palette dedicated to 3D text sprites, spatial labels, and title annotations.
 */
export interface TextColors {
  readonly title: string;
  readonly label: string;
}

/**
 * Color palette dedicated to interactive elements (gizmos, raycast highlights, selection boxes, pivot handles).
 */
export interface InteractionColors {
  readonly selection: string;
  readonly hover: string;
  readonly pivot: string;
}

/**
 * Complete WebGL Scene Theme definition contract.
 */
export interface SceneTheme {
  readonly scene: SceneColors;
  readonly text: TextColors;
  readonly interaction: InteractionColors;
}

/**
 * Authoritative registry of scene theme definitions.
 *
 * Uses `as const` to preserve exact hex literal types and `satisfies` to validate
 * that every declared key implements `SceneTheme` without widening the return type.
 */
export const sceneTheme = {
  dark: {
    scene: {
      axis: "#94a3b8",
      tick: "#64748b",
      gridMajor: "#334155",
      gridMinor: "#1e293b",
      outline: "#1e293b",
    },

    text: {
      title: "#f8fafc",
      label: "#cbd5e1",
    },

    interaction: {
      selection: "#38bdf8",
      hover: "#60a5fa",
      pivot: "#f43f5e",
    },
  },

  light: {
    scene: {
      axis: "#475569",
      tick: "#64748b",
      gridMajor: "#cbd5e1",
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
      pivot: "#e11d48",
    },
  },
} as const satisfies Record<BuiltInTheme, SceneTheme>;

/**
 * Union of valid theme names, derived dynamically from the `sceneTheme` registry keys.
 */
export type ThemeName = keyof typeof sceneTheme;

/**
 * Full registry type reference for utility/generic helper signatures.
 */
export type SceneThemes = typeof sceneTheme;

/**
 * Canonical fallback theme used across initial state initialization, unit tests, and headless context.
 */
export const DEFAULT_THEME: ThemeName = "dark";

/**
 * Pure theme resolver function.
 *
 * Serves as an abstraction boundary between raw store state and theme resolution.
 * If future features require system preference matching (`prefers-color-scheme`),
 * custom user palette overrides, or high-contrast toggles, update this logic without
 * modifying component caller sites.
 *
 * @param theme Target theme key (defaults to `DEFAULT_THEME`)
 * @returns Immutable `SceneTheme` color tokens
 */
export function getSceneTheme(theme: ThemeName = DEFAULT_THEME): SceneTheme {
  return sceneTheme[theme];
}
