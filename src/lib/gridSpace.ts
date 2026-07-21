import type { DataPoint } from "../types";

/**
 * gridSpace.ts
 *
 * Computes the derived grid geometry (display ranges, per-axis scale,
 * MIN_SCALE, and a toRenderSpace function) for a given dataset. This
 * used to be a set of module-level constants computed ONCE from a
 * static data.json import — frozen at whatever the bundled dataset
 * looked like at build time, unable to reflect a newly loaded CSV.
 * Now it's a pure function, computeGridSpace(points), re-run any time
 * the active dataset changes (see useStore.ts's setDataPoints, which
 * calls this and stores the result for components to read).
 *
 * GRID_MIN/GRID_MAX/TICK_STEP stay as true constants — the physical
 * box size (-2..2) and tick spacing are visual/layout choices, not
 * something that should change per-dataset.
 */

export const GRID_MIN = -2;
export const GRID_MAX = 2;
export const TICK_STEP = 0.5;

// Grid margin: each axis extends 10% beyond the data's extremes, so no
// point ever sits on a wall. Per the spec's worked example: the tallest
// invel_pps value 3676.470588 * 1.1 = 4044.1176 rounds up (outward) to a
// wall value of 4045.
const MARGIN = 0.1;

export interface AxisRange {
  min: number;
  max: number;
}

// The full set of derived values a dataset needs for rendering.
// Bundling these together, rather than exporting five separate
// module-level values, is what makes it possible to recompute the
// whole set atomically for a new dataset without any stale leftover
// fields from the old one.
export interface GridSpace {
  DISPLAY_RANGE: { x: AxisRange; y: AxisRange; z: AxisRange };
  SCALE: { x: number; y: number; z: number };
  MIN_SCALE: number;
  toRenderSpace: (point: DataPoint) => [number, number, number];
}

function boundingBox(points: DataPoint[]) {
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

// Computes the full GridSpace for a given dataset. Called once per
// dataset load (initial default data.json, and again every time a new
// CSV is loaded via setDataPoints) — NOT on every render, since the
// result only changes when the dataset itself changes.
export function computeGridSpace(points: DataPoint[]): GridSpace {
  const { min, max } = boundingBox(points);

  const DISPLAY_RANGE = {
    x: axisRange(min.x, max.x),
    y: axisRange(min.y, max.y),
    z: axisRange(min.z, max.z),
  };

  const SCALE = {
    x: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.x.max - DISPLAY_RANGE.x.min),
    y: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.y.max - DISPLAY_RANGE.y.min),
    z: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.z.max - DISPLAY_RANGE.z.min),
  };

  const MIN_SCALE = Math.min(SCALE.x, SCALE.y, SCALE.z);

  const CENTER = {
    x: (DISPLAY_RANGE.x.min + DISPLAY_RANGE.x.max) / 2,
    y: (DISPLAY_RANGE.y.min + DISPLAY_RANGE.y.max) / 2,
    z: (DISPLAY_RANGE.z.min + DISPLAY_RANGE.z.max) / 2,
  };

  function toRenderSpace(point: DataPoint): [number, number, number] {
    return [
      (point.x - CENTER.x) * SCALE.x,
      (point.y - CENTER.y) * SCALE.y,
      (point.z - CENTER.z) * SCALE.z,
    ];
  }

  return { DISPLAY_RANGE, SCALE, MIN_SCALE, toRenderSpace };
}
