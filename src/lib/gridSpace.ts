import data from "../data.json";

// Single source of truth for the Cartesian plotting volume. CartesianGrid.tsx
// (box geometry) and Axes.tsx (ticks/labels) both import these instead of
// each hardcoding their own copy — previously the two files duplicated
// MIN/MAX/STEP and relied on comments telling each other to stay in sync.
export const GRID_MIN = -2;
export const GRID_MAX = 2;
export const TICK_STEP = 0.5;

// Grid margin: each axis extends 10% beyond the data's extremes, so no
// point ever sits on a wall. Per the spec's worked example: the tallest
// invel_pps value 3676.470588 * 1.1 = 4044.1176 rounds up (outward) to a
// wall value of 4045.
const MARGIN = 0.1;

interface RawPoint {
  x: number;
  y: number;
  z: number;
}

function boundingBox(points: RawPoint[]) {
  if (points.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
  }
  const min = { x: points[0].x, y: points[0].y, z: points[0].z };
  const max = { x: points[0].x, y: points[0].y, z: points[0].z };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}

const { min, max } = boundingBox(data);

// The actual data-space interval a single axis of the grid represents.
// Tick labels in Axes.tsx interpolate across exactly this interval, which
// is what keeps the printed numbers equal to the raw values shown in the
// HUD's point inspector — previously labels showed distance-from-center
// values that matched no real data point.
export interface AxisRange {
  min: number;
  max: number;
}

// Expands one axis's raw data extent into the grid interval it will be
// displayed against:
// - The top wall sits 10% beyond the largest value, rounded outward to a
//   whole number (e.g. max 3676.470588 -> 1.1x = 4044.1176 -> wall 4045),
//   so the tallest point always renders visibly inside the box.
// - An all-positive axis is anchored at zero: the bottom wall reads 0
//   rather than hovering just under the smallest value, so magnitudes on
//   the axis are visually proportional to distance from the floor.
// - A negative minimum instead mirrors the top-wall rule below the
//   smallest value (10% beyond it, rounded outward).
// - Degenerate case: a dataset with zero spread on this axis (single
//   point, or all points sharing one value) would produce a zero-width
//   interval and a divide-by-zero scale; widening by 1 unit each way
//   renders those points at the axis center against a sane scale.
function axisRange(lo: number, hi: number): AxisRange {
  let rangeMin = lo > 0 ? 0 : Math.floor(lo - MARGIN * Math.abs(lo));
  let rangeMax = Math.ceil(hi + MARGIN * Math.abs(hi));
  if (rangeMin === rangeMax) {
    rangeMin -= 1;
    rangeMax += 1;
  }
  return { min: rangeMin, max: rangeMax };
}

// Per-axis display intervals. Each axis is computed independently — the
// real dataset's three columns (byte counts, packet rates, bytes-per-
// packet) live on wildly different magnitudes, and a single shared
// interval (from the widest axis) would squash the other two axes into a
// nearly flat sliver. The tradeoff: relative distances *across* axes are
// not directly comparable (a cluster that looks tight on one axis and
// wide on another may just be a scaling artifact, not a real difference
// in spread) — but each axis uses the full box, which is what's needed
// for seeing this dataset's actual shape.
export const DISPLAY_RANGE = {
  x: axisRange(min.x, max.x),
  y: axisRange(min.y, max.y),
  z: axisRange(min.z, max.z),
};

// Render-space units per data-space unit, per axis: the grid box is
// (GRID_MAX - GRID_MIN) units wide and represents (range.max - range.min)
// data units.
export const SCALE = {
  x: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.x.max - DISPLAY_RANGE.x.min),
  y: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.y.max - DISPLAY_RANGE.y.min),
  z: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.z.max - DISPLAY_RANGE.z.min),
};

// The smallest of the three per-axis scale factors — i.e. the axis that
// got compressed the hardest to fit the box. Used by PointCloud.tsx to
// size point spheres: sizing off the most-compressed axis (rather than an
// average) keeps balls from looking oversized relative to whichever
// dimension packed points closest together.
export const MIN_SCALE = Math.min(SCALE.x, SCALE.y, SCALE.z);

// Midpoint of each axis's display interval in data space — the data value
// that renders at the center of the grid box on that axis.
const CENTER = {
  x: (DISPLAY_RANGE.x.min + DISPLAY_RANGE.x.max) / 2,
  y: (DISPLAY_RANGE.y.min + DISPLAY_RANGE.y.max) / 2,
  z: (DISPLAY_RANGE.z.min + DISPLAY_RANGE.z.max) / 2,
};

// Converts a raw data point into the position it should be rendered at
// inside the fixed -2..2 box, scaling each axis independently against its
// display interval. This is purely a rendering-space transform — the
// point passed in is never mutated, so anything reading the source data
// directly (the HUD's point inspector, for example) continues to see the
// true, un-normalized values for analysis. Because tick labels in
// Axes.tsx interpolate over the same DISPLAY_RANGE, a point's rendered
// position now lines up with the axis numbers behind it.
export function toRenderSpace(point: RawPoint): [number, number, number] {
  return [
    (point.x - CENTER.x) * SCALE.x,
    (point.y - CENTER.y) * SCALE.y,
    (point.z - CENTER.z) * SCALE.z,
  ];
}
