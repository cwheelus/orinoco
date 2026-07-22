import { create } from "zustand";
import defaultData from "../data.json";
import { computeGridSpace, type GridSpace } from "../lib/gridSpace";
import type { DataPoint } from "../types";

export type { DataPoint };

// Human-facing names for each axis, e.g. "orig_bytes" — comes from
// parseCSV.ts's detected column mapping when a CSV is loaded, or the
// hardcoded defaults below for the bundled data.json. Axes.tsx and
// App.tsx's Point Analysis panel both read these instead of
// hardcoding label strings, so a newly loaded CSV's own column names
// appear everywhere automatically.
export interface AxisLabels {
  x: string;
  y: string;
  z: string;
}

// Default labels matching data.json's known source columns
// (flow-viz-sample1.csv) — used until a CSV is loaded and replaces
// them with that file's own detected column names.
const DEFAULT_AXIS_LABELS: AxisLabels = {
  x: "orig_bytes",
  y: "invel_pps",
  z: "invel_bpp",
};

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
  // The active dataset being rendered. Defaults to the bundled
  // data.json so the app still shows something on first load —
  // loading a CSV via the Toolbar replaces this entirely via
  // setDataPoints, rather than merging or appending.
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
  // The point in 3D space the camera currently orbits around and looks
  // at. Read by CameraRig.tsx (for WASD movement math) and by
  // OrbitControls in App.tsx (for mouse-drag rotation target).
  pivot: [number, number, number];
  // Whichever data point the mouse is currently hovering over, or null
  // if nothing is being hovered. Read by App.tsx to conditionally show
  // the "Point Analysis" HUD panel.
  hoveredPoint: DataPoint | null;
  // Whether the Cartesian grid (box + tick lines) is currently
  // rendered. Toggled from the Toolbar's grid on/off icon — see
  // App.tsx, which conditionally renders <CartesianGrid /> based on
  // this flag. Does not affect Axes.tsx (labels stay visible even
  // with the grid hidden, since they're still useful reference points
  // on their own).
  gridVisible: boolean;
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
  // Class names the analyst has hidden via the Data page. Points whose
  // className is in here are filtered out of the render (see
  // PointCloud.tsx). Stored as the HIDDEN set (rather than visible) so
  // the default — nothing hidden — is just an empty array.
  hiddenClasses: string[];
  // Per-axis numeric filters (on the RAW data values, matching the axis
  // tick labels). A point must satisfy every active axis filter to be
  // shown. See PointCloud.tsx for how these combine with hiddenClasses.
  numericFilters: NumericFilters;
  // Replaces the active dataset AND its derived grid geometry/labels
  // together, atomically. Called from App.tsx's CSV load handler once
  // parseCSV.ts successfully parses a file — labels come from
  // parseCSV's detected ColumnMapping (mapping.x/y/z). Also resets the
  // pivot back to the origin and clears any stale hoveredPoint, since
  // both referenced the OLD dataset's points/positions.
  setDataPoints: (points: DataPoint[], labels: AxisLabels) => void;
  // Updates the pivot. Called from PointCloud.tsx's onClick handler.
  setPivot: (p: [number, number, number]) => void;
  // Updates hoveredPoint. Called from PointCloud.tsx's onPointerOver/
  // onPointerOut handlers.
  setHoveredPoint: (p: DataPoint | null) => void;
  // Flips gridVisible. Called from the Toolbar's grid toggle button.
  toggleGrid: () => void;
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
}

export const useStore = create<VisualizerState>((set) => ({
  // Cast is safe: data.json is authored to match this exact shape.
  dataPoints: defaultData as DataPoint[],
  gridSpace: computeGridSpace(defaultData as DataPoint[]),
  axisLabels: DEFAULT_AXIS_LABELS,
  // Starting pivot: the world origin, per the project spec — the
  // camera should default to orbiting (0,0,0) until a point is clicked.
  pivot: [0, 0, 0],
  // Nothing is hovered when the app first loads.
  hoveredPoint: null,
  // Grid starts visible by default.
  gridVisible: true,
  // Orbit is the default drag behavior — matches prior versions where
  // drag-to-rotate was the only option.
  activeTool: "orbit",
  // Point size starts at the automatic size (no manual scaling).
  pointSizeScale: 1,
  // Filters start fully open — every class shown, no numeric filtering.
  availableClasses: uniqueClasses(defaultData as DataPoint[]),
  hiddenClasses: [],
  numericFilters: NO_NUMERIC_FILTERS,
  setDataPoints: (dataPoints, axisLabels) =>
    set({
      dataPoints,
      axisLabels,
      // Recompute grid geometry for the NEW dataset here, not in the
      // caller — keeps "loading a dataset" and "deriving its grid
      // space" atomic, so no other code path can set dataPoints
      // without also updating the geometry that depends on it.
      gridSpace: computeGridSpace(dataPoints),
      pivot: [0, 0, 0],
      hoveredPoint: null,
      // Recompute the class list for the new dataset, and reset all
      // filters: a new file has different class names and value ranges,
      // so carrying over the old dataset's hidden classes / numeric
      // thresholds would filter against columns that no longer mean the
      // same thing (and could silently hide everything).
      availableClasses: uniqueClasses(dataPoints),
      hiddenClasses: [],
      numericFilters: NO_NUMERIC_FILTERS,
    }),
  setPivot: (pivot) => set({ pivot }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
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
}));
