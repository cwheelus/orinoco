// theme.ts
//
// Centralized UI color/style tokens. Every component that previously
// wrote a raw Tailwind class like "text-white/70" inline now imports a
// named token instead — so changing "what body text looks like" means
// editing ONE line here, not hunting down every occurrence across
// Toolbar.tsx, App.tsx, and anywhere else it's used.
//
// This also sets up dark/light mode cleanly: each token's value can
// later become a small `light`/`dark` pair (or a CSS variable lookup)
// without touching any component — the token NAME stays the same
// everywhere it's used, only its definition here changes.
//
// Grouped by role, not by raw color value, so it reads by INTENT
// ("this is a panel background") rather than by implementation
// ("this is black at 70% opacity").

export const PANEL = {
  // The icon strip and content pane's own background.
  bg: "bg-black/70 backdrop-blur-sm",
  // The vertical line separating the content pane from the icon strip
  // (a border-l on the content pane).
  border: "border-white/10",
  // The horizontal rule INSIDE the icon strip, between the action
  // buttons above and the page tabs below — a separate element from
  // `border` above, not the same line reused.
  divider: "bg-white/10",
};

export const TEXT = {
  // Section headings (Data / Grid / Isolate).
  heading: "text-[10px] font-bold text-blue-400 uppercase",
  // Primary body/label text — the most common weight, used for most
  // labels throughout the panel (e.g. "Filters", "Tick labels", axis
  // checkbox labels).
  body: "text-white/70",
  // Small uppercase section sub-labels (e.g. "Classes", "Value").
  subtle: "text-[9px] uppercase tracking-wide text-white/40",
  // Muted inline text — slightly dimmer than `body`, used for
  // secondary info: axis labels in mono font, tick-density/point-size
  // values, the Isolate page's caption and octant-status text, and
  // the class list's EyeOff (hidden-state) icon.
  muted: "text-white/50",
  // Faint hint/caption text — the dimmest tier, used for slider end
  // labels ("Smaller"/"Larger", "Coarse"/"Fine") and scaling-mode
  // descriptions. Bumped from the original /30 to /45: at /30, white
  // text on this dark background falls below WCAG AA's 4.5:1 contrast
  // ratio for text this size — this tier is still meaningfully used
  // (slider bounds, mode descriptions), not purely decorative, so it
  // needs to actually be legible. /45 restores compliance while
  // staying visually the dimmest tier relative to `muted` and `body`.
  faint: "text-white/45",
  // Emphasized text — brighter, near-full-white. Used for the Data
  // page's class-list names, the CSV-load error banner's message
  // body, and the color-legend's class labels — content that should
  // read clearly without being as bright as `onFilled`.
  emphasis: "text-white/80",
  // Fully opaque white — for text sitting directly on a filled/active
  // background where full contrast is needed. Not yet referenced in
  // this file (INPUT.base bakes its own white text in directly) —
  // reserved for App.tsx's Point Analysis panel (UID/value text),
  // which hasn't been refactored to these tokens yet.
  onFilled: "text-white",
  // Default (non-hover) icon color for small inline icons like the
  // Data page's per-class Eye/EyeOff indicator — sits between `muted`
  // and `emphasis` in brightness.
  iconDefault: "text-white/60",
};

export const LINK = {
  // Clickable inline text actions (Clear filters, Reset isolation).
  base: "text-blue-400 hover:text-blue-300 transition-colors",
};

export const INPUT = {
  // Text inputs, selects, number fields.
  base: "bg-white/10 text-white outline-none focus:bg-white/20",
  // The <option> elements inside a <select> need their own opaque
  // background — a translucent one lets the page show through the
  // browser's native dropdown list, which looks broken.
  optionBg: "bg-slate-800",
};

export const HOVER = {
  // Subtle hover — list rows sitting on a transparent background
  // (e.g. the Data page's per-class filter buttons). Icon-strip
  // buttons don't use this — their hover state is baked directly
  // into ICON_BUTTON.idle below instead.
  subtle: "hover:bg-white/5",
};

export const ICON_BUTTON = {
  // Applied when a toggle/page icon is the active/selected one.
  active: "bg-blue-500/40 text-white",
  // Applied otherwise — dim by default, brightens on hover.
  idle: "text-white/50 hover:bg-white/10 hover:text-white",
};

// --- App.tsx-specific tokens below ---
// The Toolbar's panels (icon strip, content pane) and App.tsx's HUD
// panels (Point Analysis card, control guide, color legend) are
// visually DIFFERENT surfaces on purpose — different backgrounds,
// different opacities, different roles. They're kept as separate,
// named tokens rather than forced into one shared "panel" look,
// since collapsing genuinely different designs into one token would
// hide real intent, not simplify it.

export const SURFACE = {
  // The app's root background, behind everything.
  root: "bg-slate-900",
  // The Point Analysis card's background — a translucent version of
  // the same base color as `root`, so the 3D scene stays faintly
  // visible behind the card rather than looking like a separate,
  // opaque window.
  card: "bg-slate-900/80 backdrop-blur-md",
};

export const PANEL_APP = {
  // The bottom-left keyboard control-guide box.
  controlGuide: "bg-white/5 backdrop-blur-sm border border-white/10 rounded",
  // The bottom-right classification color-legend box.
  legend: "bg-black/60 ring-1 ring-white/10 rounded",
  // Thin separator lines used WITHIN a panel (between Point Analysis
  // metric rows, and the small vertical dividers between control-guide
  // groups) — deliberately fainter than PANEL.border above, which
  // separates entire panels from each other rather than rows within one.
  hairline: "border-white/5",
};

export const ERROR = {
  // The CSV-load error/info banner.
  bg: "bg-red-950/80 backdrop-blur-md border-l-2 border-red-500 ring-1 ring-white/10 shadow-2xl",
  label: "text-red-400",
};

export const KBD = {
  // A single keyboard-key chip (used for every WASD/arrow/Spc/Shift
  // key in the bottom control guide). Defined once here — but see
  // App.tsx's new <Kbd> component, which wraps this token so the
  // identical markup (padding, rounding, font) that used to be
  // hand-repeated 7 times is now written once and reused, rather than
  // just having 7 copies of the same className string.
  base: "px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono",
};
