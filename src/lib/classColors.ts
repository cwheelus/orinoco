/**
 * Classification -> display color resolution.
 *
 * PUBLIC API: getClassColor() only. Every consumer (PointCloud.tsx's
 * sphere material, App.tsx's HUD legend, the Data page's class list)
 * must go through this function — BUILTIN_CLASS_COLORS, fnv1aHash, and
 * generatedColor are intentionally NOT exported, so nothing can bypass
 * the precedence chain below by reading internals directly.
 *
 * PRECEDENCE (highest to lowest):
 *   1. Manual override  — an analyst-picked color for this class,
 *      stored in the Zustand store's classColorOverrides map. Not
 *      wired up yet (Phase 2/3 — see below); getClassColor already
 *      accepts an overrides argument so consumers don't need to
 *      change again when that lands.
 *   2. Built-in color    — the four original semantic colors
 *      (normal/nss/qc/zt), unchanged from the original spec.
 *   3. Generated color   — deterministic, derived from the class
 *      name itself via a synchronous hash. Same name always produces
 *      the same color, on every reload, in every dataset, forever —
 *      this identity guarantee is deliberately NOT sacrificed for
 *      better visual spacing between colors (see below).
 *
 * DESIGN DECISIONS (settled after real back-and-forth — recorded here
 * so a future maintainer doesn't "fix" these into the same mistakes):
 *
 * - No dataset-aware collision avoidance. It's tempting to detect when
 *   two currently-loaded classes hash to a similar color and nudge one
 *   away — but that makes a class's color depend on what OTHER classes
 *   happen to be loaded alongside it, which breaks the one guarantee
 *   this system exists to provide: "nss is always red, regardless of
 *   what else is in the file." If collisions become a real problem in
 *   practice, the right fix is an explicit, opt-in "Reassign Generated
 *   Colors" action the analyst can trigger for a specific dataset —
 *   NOT a silent default behavior. Not built yet.
 *
 * - No theme-awareness. Unlike lib/sceneTheme.ts and lib/theme.ts
 *   (which DO adapt to light/dark mode, since they style UI chrome),
 *   classification colors represent the DATA's meaning, not the
 *   viewer's context — held constant across themes so an analyst's
 *   color mapping stays valid regardless of mode, and screenshots
 *   stay comparable across sessions.
 *
 * - No async hashing, no external color library. FNV-1a is a small,
 *   synchronous, dependency-free string hash — sufficient here since
 *   we aren't relying on hash quality for collision-free spacing (see
 *   above), just for a stable, deterministic mapping.
 *
 * - getClassColor() ALWAYS returns "#rrggbb" hex, never an HSL string
 *   — even though generatedColor() computes hue/saturation/lightness
 *   internally, it converts to hex before returning. This is a
 *   deliberate API-stability choice: getClassColor() is the single
 *   public abstraction every consumer goes through, so it gets ONE
 *   canonical return format for its lifetime rather than changing
 *   shape later when <input type="color"> (Phase 3's color picker)
 *   needs hex specifically. Every consumer, every override, every
 *   future export/serialization path can assume hex without checking.
 *
 * MIGRATION PHASES (each independently shippable/testable):
 *   Phase 1 (this file): getClassColor(className) replaces
 *     classColors[className] ?? DEFAULT_CLASS_COLOR at every call
 *     site. No store changes. Existing classes render identically;
 *     unknown classes get a deterministic color instead of white.
 *   Phase 2: add classColorOverrides to the Zustand store.
 *   Phase 3: consumers pass classColorOverrides into getClassColor's
 *     second argument. Nothing else changes.
 *   Phase 4: build the color-picker UI that actually sets overrides.
 */

// The four original semantic colors, unchanged from the project's
// original spec. Intentionally NOT exported — see the file header.
const BUILTIN_CLASS_COLORS: Record<string, string> = {
  normal: "#dddddd",
  nss: "#dd0000",
  qc: "#00dd00",
  zt: "#0000dd",
};

// FNV-1a, a small non-cryptographic string hash: fast, synchronous,
// well-distributed enough for this purpose (we aren't relying on it
// for collision-free spacing — see the file header's design notes).
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime multiplication, kept within 32-bit unsigned range.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// Fixed saturation/lightness for every generated color — chosen to
// read clearly against the app's dark background without being
// theme-aware (see file header). Only the hue varies per class name.
const GENERATED_SATURATION = 70;
const GENERATED_LIGHTNESS = 52;

// Converts HSL (hue 0-360, saturation/lightness 0-100) to a "#rrggbb"
// hex string. Small local implementation rather than a dependency —
// see the file header's design notes on why hex is the API's one
// canonical output format.
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Deterministic color for any class name not in BUILTIN_CLASS_COLORS.
// Same name -> same hue -> same color, every time, independent of
// what other classes exist in the currently loaded dataset. Always
// returns hex — see the file header's API-stability design note.
function generatedColor(className: string): string {
  const hue = fnv1aHash(className) % 360;
  return hslToHex(hue, GENERATED_SATURATION, GENERATED_LIGHTNESS);
}

/**
 * Resolves the display color for a classification value. The ONLY
 * function any component should call — see the file header for why
 * BUILTIN_CLASS_COLORS itself is not exported.
 *
 * @param className The classification value from the loaded dataset.
 * @param overrides The analyst's manual color picks, if any. Optional
 *   and defaults to empty — Phase 1 call sites can omit this entirely
 *   (`getClassColor(className)`) and adopt overrides later (Phase 3)
 *   without a second signature change.
 */
export function getClassColor(
  className: string,
  overrides: Readonly<Record<string, string>> = {},
): string {
  return (
    overrides[className] ??
    BUILTIN_CLASS_COLORS[className] ??
    generatedColor(className)
  );
}
