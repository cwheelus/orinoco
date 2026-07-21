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
  // User-controlled multiplier on the auto-computed point radius,
  // driven by the "Point size" slider in the Toolbar's Data page. 1 =
  // the automatic size; below 1 shrinks (declutter dense clouds),
  // above 1 enlarges (emphasize sparse data / easier to click). The
  // AUTOMATIC size already scales down with point count (see
  // PointCloud.tsx); this is the analyst's manual override on top.
  pointSizeScale: number;
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
  // Sets the user point-size multiplier. Called from the Data page's
  // "Point size" slider in the Toolbar.
  setPointSizeScale: (v: number) => void;
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
  // Point size starts at the automatic size (no manual scaling).
  pointSizeScale: 1,
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
    }),
  setPivot: (pivot) => set({ pivot }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  setPointSizeScale: (pointSizeScale) => set({ pointSizeScale }),
}));
