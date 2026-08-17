import { create } from "zustand";
import {
  computeGridSpace,
  type GridSpace,
  type ScalingMode,
  type OctantSign,
} from "../lib/gridSpace";
import type { DataPoint } from "../types";
import {
  type DatasetSchema,
  type ColumnMapping,
  buildPoints,
} from "../lib/parseCSV";
import { config } from "../lib/config";
import { CODES, type ErrorCode, type Severity } from "../lib/errorCodes";
import { distinctReasons, type SkippedRow } from "../lib/parseCSV";

export type { ScalingMode, OctantSign };

// One diagnostic shown in the Console page (and, for errors/warnings,
// echoed in the HUD banner). Built by pushLog from an ErrorCode plus a
// message, so the code/severity/title can never drift from the registry
// in lib/errorCodes.ts.
export interface LogEntry {
  // Monotonic id — used as the React key and to identify the newest
  // entry. Not an array index, since the buffer is trimmed from the
  // front once it fills.
  id: number;
  timestamp: number;
  code: string;
  severity: Severity;
  title: string;
  message: string;
  // Extra lines shown only in the Console — the banner stays compact.
  detail?: string[];
}

// Ring-buffer cap. Without one, a session that loads many malformed
// files would grow this array unboundedly; the oldest entries are the
// least useful, so they're the ones dropped.
const MAX_LOG_ENTRIES = config.console.maxEntries;
// How many individual excluded rows get listed before the detail is
// summarized instead. A 50k-row file with a bad column would otherwise
// try to render 50k lines.
const MAX_LISTED_ROWS = config.console.maxListedRows;

let nextLogId = 1;

/**
 * Formats a skip list into console detail lines: the individual rows up
 * to MAX_LISTED_ROWS, then a per-reason summary once it's longer than
 * that. Shared by the dataset and color-file paths so both read the
 * same way.
 */
export function formatSkippedRows(skipped: SkippedRow[]): string[] {
  if (skipped.length <= MAX_LISTED_ROWS) {
    return skipped.map((s) => `Row ${s.row}: ${s.reason}`);
  }
  return [
    ...skipped
      .slice(0, MAX_LISTED_ROWS)
      .map((s) => `Row ${s.row}: ${s.reason}`),
    `…and ${skipped.length - MAX_LISTED_ROWS} more. Totals by cause:`,
    ...distinctReasons(skipped),
  ];
}

// The analyst's typed ± bound per axis for "custom" scaling, kept as raw
// text-box strings (so an in-progress "-" or "" doesn't coerce to 0) —
// computeGridSpace parses them and falls back to the auto value for any
// axis left blank/invalid.
export interface CustomBounds {
  x: string;
  y: string;
  z: string;
}
const EMPTY_CUSTOM_BOUNDS: CustomBounds = { x: "", y: "", z: "" };

// Builds the ScalingConfig computeGridSpace expects from the store's mode
// + raw text bounds — parsing the strings to numbers (NaN if invalid).
function scalingConfig(mode: ScalingMode, bounds: CustomBounds) {
  return {
    mode,
    custom: {
      x: parseFloat(bounds.x),
      y: parseFloat(bounds.y),
      z: parseFloat(bounds.z),
    },
  };
}

// Every input computeGridSpace depends on, in one place. Each setter that
// changes any of them (dataset, scaling mode, custom bounds, isolated
// octant) recomputes through this rather than repeating the wiring — so a
// new dependency can't be silently missed by one call site.
function gridSpaceFor(s: {
  dataPoints: DataPoint[];
  scalingMode: ScalingMode;
  customBounds: CustomBounds;
  isolatedOctant: OctantSign | null;
}): GridSpace {
  return computeGridSpace(
    s.dataPoints,
    scalingConfig(s.scalingMode, s.customBounds),
    s.isolatedOctant,
  );
}

export type { DataPoint };

// Human-facing names for each axis, e.g. "orig_bytes" — comes from
// parseCSV.ts's detected column mapping when a CSV is loaded, or the
// placeholder defaults below until the first CSV loads. Axes.tsx and
// App.tsx's Point Analysis panel both read these instead of
// hardcoding label strings, so a newly loaded CSV's own column names
// appear everywhere automatically.
export interface AxisLabels {
  x: string;
  y: string;
  z: string;
}

// Placeholder labels shown for the brief moment before App.tsx's
// mount-time load replaces them with the loaded file's own detected
// column names. Defaults match the bundled sample CSV's columns; see
// config.json's defaults.axisLabels.
const DEFAULT_AXIS_LABELS: AxisLabels = { ...config.defaults.axisLabels };

// A single numeric filter on one axis. "off" means the axis isn't
// filtered. "between" is an inclusive range using BOTH value (min) and
// value2 (max); every other op is a single inequality using value only.
// Values are kept as raw text-box strings so an in-progress entry like
// "-" or "" doesn't get coerced to 0 mid-typing — PointCloud parses them
// and ignores anything that isn't a finite number (which also makes a
// "between" with only one box filled act as a single-sided bound).
export type FilterOp = "off" | "gt" | "gte" | "lt" | "lte" | "eq" | "between";
export interface NumericFilter {
  op: FilterOp;
  value: string; // single-op operand, or the range MIN for "between"
  value2: string; // the range MAX for "between" (unused by single ops)
}
export interface NumericFilters {
  x: NumericFilter;
  y: NumericFilter;
  z: NumericFilter;
}
export type AxisKey = "x" | "y" | "z";
export type ActiveTool = "orbit" | "pan";
const OFF_FILTER: NumericFilter = { op: "off", value: "", value2: "" };
const NO_NUMERIC_FILTERS: NumericFilters = {
  x: { ...OFF_FILTER },
  y: { ...OFF_FILTER },
  z: { ...OFF_FILTER },
};

// The distinct class names present in a dataset, in first-seen order —
// what the Data page's class-visibility list is built from. Computed
// once per dataset (in setDataPoints / at init) rather than re-scanning
// the (potentially 100k-row) dataset on every Toolbar render.
function uniqueClasses(points: DataPoint[]): string[] {
  const seen = new Set<string>();
  for (const p of points) seen.add(p.className);
  return [...seen];
}

interface VisualizerState {
  // The active dataset being rendered. Starts empty; App.tsx loads the
  // bundled sample CSV on mount (and the Toolbar loads user CSVs), both
  // via setDataPoints, which replaces this entirely rather than merging
  // or appending.
  dataPoints: DataPoint[];
  // Derived grid geometry (display ranges, per-axis scale, MIN_SCALE,
  // and a ready-to-use toRenderSpace function) for the CURRENT
  // dataPoints. Recomputed by setDataPoints whenever the dataset
  // changes — see lib/gridSpace.ts's computeGridSpace. Components
  // (Axes.tsx, CartesianGrid.tsx, PointCloud.tsx) read this instead of
  // importing gridSpace.ts's old static, load-time-only constants.
  gridSpace: GridSpace;
  // Which real column name is plotted on each axis, e.g.
  // { x: "orig_bytes", y: "invel_pps", z: "invel_bpp" }. Axes.tsx and
  // App.tsx's Point Analysis panel both read these instead of
  // hardcoded label strings.
  axisLabels: AxisLabels;
  // Full parser-detected schema for the active dataset (headers,
  // numeric/text columns, uid/class columns, dimension). null until
  // the first dataset loads. See lib/parseCSV.ts's DatasetSchema.
  datasetSchema: DatasetSchema | null;
  // Non-numeric field values per point, keyed by uid — see
  // lib/parseCSV.ts's ParseResult.metadata for the full contract.
  // null until the first dataset loads.
  pointMetadata: Record<string, Record<string, string>> | null;
  // Original parsed CSV rows for the active dataset, retained so axis
  // selections can be changed without reparsing or re-uploading the
  // file. null until the first dataset loads. See setColumnMapping.
  rawRows: Record<string, string>[] | null;
  // Which real column is currently mapped to uid/className/x/y/z.
  // Defaults to parseCSV's auto-detected mapping (first 2/3 numeric
  // columns); overridden via setColumnMapping when the analyst picks
  // axes manually in the Data panel. null until the first dataset
  // loads.
  columnMapping: ColumnMapping | null;
  // The point in 3D space the camera currently orbits around and looks
  // at. Read by CameraRig.tsx (for WASD movement math) and by
  // OrbitControls in App.tsx (for mouse-drag rotation target).
  pivot: [number, number, number];
  // Whichever data point the mouse is currently hovering over, or null
  // if nothing is being hovered. Read by App.tsx to conditionally show
  // the "Point Analysis" HUD panel.
  hoveredPoint: DataPoint | null;
  // Which axis's label is currently being hovered ("x"/"y"/"z"), or
  // null. Axis labels are truncated for display (see truncateLabel.ts)
  // per #59 — this drives an HTML tooltip in App.tsx showing the full,
  // untruncated axisLabels[axis] value on hover, since drei's <Text>
  // renders into the WebGL scene and has no native DOM title
  // attribute. See Axes.tsx's onPointerOver/onPointerOut.
  hoveredAxis: AxisKey | null;
  // Whether the Cartesian grid (box + tick lines) is currently
  // rendered. Toggled from the Toolbar's grid on/off icon — see
  // App.tsx, which conditionally renders <CartesianGrid /> based on
  // this flag. Does not affect Axes.tsx (labels stay visible even
  // with the grid hidden, since they're still useful reference points
  // on their own).
  gridVisible: boolean;
  // Whether the interface renders in dark or light mode. Toggled from
  // the Toolbar's sun/moon icon. Purely a presentation preference —
  // doesn't affect any data, grid math, or the 3D scene's own colors
  // (see lib/theme.ts, whose tokens read this to pick their light/dark
  // variant). Defaults to dark, matching the app's original design.
  darkMode: boolean;
  // Which navigation mode mouse-drag currently performs: "orbit" rotates
  // around the pivot (default, via OrbitControls); "pan" translates the
  // camera/pivot together instead (via CameraRig's drag handler). Toggled
  // from the Toolbar's hand-tool button.
  activeTool: ActiveTool;
  // User-controlled multiplier on the auto-computed point radius,
  // driven by the "Point size" slider in the Toolbar's Data page. 1 =
  // the automatic size; below 1 shrinks (declutter dense clouds),
  // above 1 enlarges (emphasize sparse data / easier to click). The
  // AUTOMATIC size already scales down with point count (see
  // PointCloud.tsx); this is the analyst's manual override on top.
  pointSizeScale: number;
  // The distinct class names in the current dataset (first-seen order).
  // Drives the Data page's class-visibility toggle list.
  availableClasses: string[];
  // Analyst's manual color overrides per class name. Keys are class names,
  // values are "#rrggbb" hex strings. Empty by default; populated by the
  // color-picker UI (Phase 4). getClassColor() reads this map as the
  // highest-precedence source — see lib/classColors.ts.
  classColorOverrides: Record<string, string>;
  // Class names the analyst has hidden via the Data page. Points whose
  // className is in here are filtered out of the render (see
  // PointCloud.tsx). Stored as the HIDDEN set (rather than visible) so
  // the default is just an empty array.
  hiddenClasses: string[];
  // Per-axis numeric filters (on the RAW data values, matching the axis
  // tick labels). A point must satisfy every active axis filter to be
  // shown. See PointCloud.tsx for how these combine with hiddenClasses.
  numericFilters: NumericFilters;
  // Which axes' tick marks/numbers are currently hidden — independent
  // per axis (e.g. hide Y's ticks while keeping X and Z visible).
  // Modeled on hiddenClasses' array-of-hidden-keys pattern. Each axis's
  // numeric tick labels hide independently; the axis line and its name
  // label always stay — see Axes.tsx.
  hiddenTickAxes: AxisKey[];
  // Active axis-scaling mode — see gridSpace.ts's ScalingMode. Selected
  // from the Grid page. Changing it recomputes gridSpace (below).
  scalingMode: ScalingMode;
  // The analyst's typed ± bounds per axis, used only in "custom" mode.
  customBounds: CustomBounds;
  // Which octant ("quadrant") is currently isolated, or null for the full
  // grid. When set, the grid rescales so that octant fills the whole box
  // and PointCloud hides every point outside it. Chosen from the Isolate
  // page's cube gizmo.
  isolatedOctant: OctantSign | null;
  // Target number of tick marks per side on each axis — the "granularity"
  // slider in the Grid page. Axes.tsx picks the nearest nice-number step
  // to roughly hit this count, so a higher value = finer ticks. Purely a
  // display preference; doesn't affect gridSpace or the data.
  tickDensity: number;
  // Toggles whether an axis's tick marks/numbers are shown. Called
  // from the Toolbar's Grid page tick-visibility checkboxes.
  toggleTickAxis: (axis: AxisKey) => void;
  // Sets the tick-granularity target. Called from the Grid page's tick
  // density slider.
  setTickDensity: (n: number) => void;
  // Isolates an octant (or clears back to the full grid with null) and
  // recomputes the grid geometry. Called from the Isolate page's gizmo.
  setIsolatedOctant: (octant: OctantSign | null) => void;
  // Sets the scaling mode and recomputes gridSpace. Called from the Grid
  // page's scaling-mode selector.
  setScalingMode: (mode: ScalingMode) => void;
  // Updates one axis's custom ± bound and recomputes gridSpace. Called
  // from the Grid page's custom-bound inputs.
  setCustomBound: (axis: AxisKey, value: string) => void;
  // Replaces the active dataset AND its derived grid geometry/labels
  // together, atomically. Called from App.tsx's CSV load handler once
  // parseCSV.ts successfully parses a file — labels come from
  // parseCSV's detected ColumnMapping (mapping.x/y/z). Also resets the
  // pivot back to the origin and clears any stale hoveredPoint, since
  // both referenced the OLD dataset's points/positions.
  setDataPoints: (
    points: DataPoint[],
    labels: AxisLabels,
    schema: DatasetSchema,
    metadata: Record<string, Record<string, string>>,
    rows: Record<string, string>[],
    mapping: ColumnMapping,
  ) => void;
  // Rebuilds points/metadata from the retained rawRows using a new
  // column mapping — no reparse or re-upload needed. Called from the
  // Data panel's X/Y/Z axis dropdowns. No-ops (returns state
  // unchanged) if no dataset has been loaded yet.
  setColumnMapping: (mapping: ColumnMapping) => void;
  // Updates the pivot. Called from PointCloud.tsx's onClick handler.
  setPivot: (p: [number, number, number]) => void;
  // Updates hoveredPoint. Called from PointCloud.tsx's onPointerOver/
  // onPointerOut handlers.
  setHoveredPoint: (p: DataPoint | null) => void;
  // Updates hoveredAxis. Called from Axes.tsx's onPointerOver/
  // onPointerOut handlers on each axis's <Text> label.
  setHoveredAxis: (axis: AxisKey | null) => void;
  // Flips gridVisible. Called from the Toolbar's grid toggle button.
  toggleGrid: () => void;
  // Flips darkMode. Called from the Toolbar's dark/light toggle button.
  toggleDarkMode: () => void;
  // Sets the active mouse-drag tool. Called from the Toolbar's hand-tool
  // toggle button.
  setActiveTool: (tool: ActiveTool) => void;
  // Sets the user point-size multiplier. Called from the Data page's
  // "Point size" slider in the Toolbar.
  setPointSizeScale: (v: number) => void;
  // Toggles whether a class is hidden. Called from the Data page's
  // per-class visibility buttons.
  toggleClassHidden: (className: string) => void;
  // Sets the numeric filter for one axis. Called from the Data page's
  // per-axis operator dropdown + value box.
  setNumericFilter: (axis: AxisKey, filter: NumericFilter) => void;
  // Clears all class and numeric filters back to "show everything".
  clearFilters: () => void;
  // Sets a manual color override for one class. Called from the color
  // picker UI (Phase 4). Passing an empty string removes the override.
  setClassColor: (className: string, color: string) => void;
  // Clears all manual color overrides back to generated/built-in colors.
  resetClassColors: () => void;
  // Replaces the entire override map at once — used when loading a
  // colors.csv file (see lib/parseColorsCSV.ts), so an N-row file
  // becomes one store update instead of N calls to setClassColor.
  setClassColorOverrides: (overrides: Record<string, string>) => void;
  // Every diagnostic raised this session, oldest first. Drives the
  // Console page; the HUD banner shows only the newest non-info entry.
  // Lives in the store (not App-local state) precisely because two
  // separate components need to read it — the old single-string
  // useState could not be shared, so each new message destroyed the
  // previous one.
  logEntries: LogEntry[];
  // Appends a diagnostic. Takes the ErrorCode registry entry rather
  // than loose strings, so code/severity/title always agree with
  // lib/errorCodes.ts.
  pushLog: (code: ErrorCode, message: string, detail?: string[]) => void;
  // Empties the console. Called from the Console page's Clear button.
  clearLog: () => void;
}

// Single source of truth for 2D mode.
// A dataset is 2D only after a mapping exists and no Z column is mapped.
// columnMapping === null means no dataset has loaded yet, not 2D.
// See #62/#63.
export const selectIs2D = (state: VisualizerState): boolean =>
  state.columnMapping != null && state.columnMapping.z == null;

export const useStore = create<VisualizerState>((set) => ({
  // The app starts with NO data — App.tsx loads the bundled sample CSV
  // through the normal parseCSV → setDataPoints pipeline on mount, so
  // there is no separate hardcoded-JSON code path. Until that resolves
  // (a tick after mount) the scene shows an empty grid.
  dataPoints: [],
  gridSpace: computeGridSpace(
    [],
    scalingConfig(config.defaults.scalingMode, EMPTY_CUSTOM_BOUNDS),
  ),
  axisLabels: DEFAULT_AXIS_LABELS,
  // No dataset schema until the first CSV loads (see setDataPoints).
  datasetSchema: null,
  pointMetadata: null,
  rawRows: null,
  columnMapping: null,
  // Starting pivot: the world origin, per the project spec — the
  // camera should default to orbiting (0,0,0) until a point is clicked.
  pivot: [0, 0, 0],
  // Nothing is hovered when the app first loads.
  hoveredPoint: null,
  hoveredAxis: null,
  // Startup state — all from config.json's `defaults` section.
  // Grid starts visible.
  gridVisible: config.defaults.gridVisible,
  // Dark mode ships as the default, matching the app's original (only)
  // appearance before light mode existed.
  darkMode: config.defaults.darkMode,
  // Orbit is the default drag behavior — matches prior versions where
  // drag-to-rotate was the only option.
  activeTool: config.defaults.activeTool,
  // Point size starts at the automatic size (no manual scaling).
  pointSizeScale: config.defaults.pointSizeScale,
  // Filters start fully open — every class shown, no numeric filtering.
  // Empty until the sample CSV loads on mount (setDataPoints fills it).
  availableClasses: [],
  classColorOverrides: {},
  hiddenClasses: [],
  numericFilters: NO_NUMERIC_FILTERS,
  // All axes' tick marks/numbers visible by default. Unlike
  // hiddenClasses/numericFilters, this is NOT reset in setDataPoints
  // below — tick visibility is a display preference tied to X/Y/Z
  // themselves (which always exist), not to a specific dataset's
  // content, so there's no reason to clear it when a new CSV loads.
  hiddenTickAxes: [],
  // Full grid by default — no octant isolated.
  isolatedOctant: null,
  // Scaling starts in per-axis auto-normalized mode, no custom bounds.
  scalingMode: config.defaults.scalingMode,
  customBounds: EMPTY_CUSTOM_BOUNDS,
  // Default tick granularity, in ticks per side (Axes.tsx nice-rounds it).
  tickDensity: config.defaults.tickDensity,
  setDataPoints: (
    dataPoints,
    axisLabels,
    datasetSchema,
    pointMetadata,
    rawRows,
    columnMapping,
  ) =>
    set((state) => ({
      dataPoints,
      axisLabels,
      datasetSchema,
      pointMetadata,
      rawRows,
      columnMapping,
      // Recompute against the CURRENT scaling mode/bounds so a loaded CSV
      // respects whatever scaling the analyst has selected. Custom bounds
      // are kept (not reset) — they're a display preference, and any that
      // don't fit the new data just fall back to auto per axis. Isolation
      // IS cleared: an octant selected against the old dataset says
      // nothing about the new one, and silently hiding 7/8 of a
      // freshly-loaded file would look like a broken load.
      gridSpace: gridSpaceFor({ ...state, dataPoints, isolatedOctant: null }),
      isolatedOctant: null,
      pivot: [0, 0, 0],
      hoveredPoint: null,
      // Prevents a stuck axis-label tooltip if a dataset loads while the
      // mouse still happens to be over a (now-replaced) axis label — see
      // Axes.tsx's hover handlers and App.tsx's tooltip render (Copilot
      // review, PR #65).
      hoveredAxis: null,
      availableClasses: uniqueClasses(dataPoints),
      hiddenClasses: [],
      numericFilters: NO_NUMERIC_FILTERS,
    })),
  setColumnMapping: (mapping) =>
    set((state) => {
      if (!state.rawRows || !state.datasetSchema) return state;
      const rebuilt = buildPoints(state.rawRows, state.datasetSchema, mapping);
      const axisLabels: AxisLabels = {
        x: mapping.x,
        y: mapping.y,
        // No column mapped to Z (a 2D dataset, or Z set to "None") —
        // fall back to the configured placeholder name.
        z: mapping.z ?? config.defaults.unmappedAxisLabel,
      };
      // Axis mapping can change which rows produce valid points, so
      // rebuild the available class list from the rebuilt points and
      // discard hidden classes that no longer exist.
      // classColorOverrides is intentionally preserved because colors
      // are keyed by class name rather than axis selection.
      const newAvailableClasses = uniqueClasses(rebuilt.points);
      const availableClassSet = new Set(newAvailableClasses);
      const prunedHiddenClasses = state.hiddenClasses.filter((c) =>
        availableClassSet.has(c),
      );

      // Remapping axes can drop rows that the PREVIOUS mapping accepted
      // (a column that parsed cleanly as X may have gaps when used as
      // Z). That used to happen silently — the point count would change
      // with no explanation. Log it like any other exclusion.
      const remapLog: LogEntry[] = [
        {
          id: nextLogId++,
          timestamp: Date.now(),
          code: CODES.CSV_REMAPPED.code,
          severity: CODES.CSV_REMAPPED.severity,
          title: CODES.CSV_REMAPPED.title,
          message: `Axes remapped to ${mapping.x} / ${mapping.y} / ${mapping.z ?? "none"} — ${rebuilt.points.length} point(s) plotted.`,
          detail:
            rebuilt.skippedRows.length > 0
              ? formatSkippedRows(rebuilt.skippedRows)
              : undefined,
        },
      ];
      const nextLog = [...state.logEntries, ...remapLog];

      return {
        logEntries:
          nextLog.length > MAX_LOG_ENTRIES
            ? nextLog.slice(nextLog.length - MAX_LOG_ENTRIES)
            : nextLog,
        dataPoints: rebuilt.points,
        pointMetadata: rebuilt.metadata,
        columnMapping: mapping,
        axisLabels,
        availableClasses: newAvailableClasses,
        hiddenClasses: prunedHiddenClasses,
        // Numeric filters, isolated octant, and pivot refer to the
        // previous axis mapping and are reset when the plotted
        // columns change.
        gridSpace: gridSpaceFor({
          ...state,
          dataPoints: rebuilt.points,
          isolatedOctant: null,
        }),
        isolatedOctant: null,
        pivot: [0, 0, 0],
        hoveredPoint: null,
        numericFilters: NO_NUMERIC_FILTERS,
      };
    }),
  setPivot: (pivot) => set({ pivot }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
  setHoveredAxis: (hoveredAxis) => set({ hoveredAxis }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setActiveTool: (activeTool) => set({ activeTool }),
  setPointSizeScale: (pointSizeScale) => set({ pointSizeScale }),
  toggleClassHidden: (className) =>
    set((state) => ({
      hiddenClasses: state.hiddenClasses.includes(className)
        ? state.hiddenClasses.filter((c) => c !== className)
        : [...state.hiddenClasses, className],
    })),
  setNumericFilter: (axis, filter) =>
    set((state) => ({
      numericFilters: { ...state.numericFilters, [axis]: filter },
    })),
  clearFilters: () =>
    set({ hiddenClasses: [], numericFilters: NO_NUMERIC_FILTERS }),
  toggleTickAxis: (axis) =>
    set((state) => ({
      hiddenTickAxes: state.hiddenTickAxes.includes(axis)
        ? state.hiddenTickAxes.filter((a) => a !== axis)
        : [...state.hiddenTickAxes, axis],
    })),
  setTickDensity: (tickDensity) => set({ tickDensity }),
  setIsolatedOctant: (isolatedOctant) =>
    set((state) => ({
      isolatedOctant,
      gridSpace: gridSpaceFor({ ...state, isolatedOctant }),
      // Re-center on the new view: the old pivot was a coordinate in the
      // pre-isolation mapping, so keeping it would leave the camera
      // orbiting a point that no longer corresponds to the same data.
      pivot: [0, 0, 0],
    })),
  setScalingMode: (scalingMode) =>
    set((state) => ({
      scalingMode,
      gridSpace: gridSpaceFor({ ...state, scalingMode }),
    })),
  setCustomBound: (axis, value) =>
    set((state) => {
      const customBounds = { ...state.customBounds, [axis]: value };
      return {
        customBounds,
        gridSpace: gridSpaceFor({ ...state, customBounds }),
      };
    }),
  setClassColor: (className, color) =>
    set((state) => ({
      classColorOverrides: color
        ? { ...state.classColorOverrides, [className]: color }
        : Object.fromEntries(
            Object.entries(state.classColorOverrides).filter(
              ([k]) => k !== className,
            ),
          ),
    })),
  resetClassColors: () => set({ classColorOverrides: {} }),
  setClassColorOverrides: (classColorOverrides) => set({ classColorOverrides }),
  logEntries: [],
  pushLog: (code, message, detail) =>
    set((state) => {
      const entry: LogEntry = {
        id: nextLogId++,
        timestamp: Date.now(),
        code: code.code,
        severity: code.severity,
        title: code.title,
        message,
        detail: detail && detail.length > 0 ? detail : undefined,
      };
      const next = [...state.logEntries, entry];
      // Trim from the front once past the cap, keeping the newest.
      return {
        logEntries:
          next.length > MAX_LOG_ENTRIES
            ? next.slice(next.length - MAX_LOG_ENTRIES)
            : next,
      };
    }),
  clearLog: () => set({ logEntries: [] }),
}));
