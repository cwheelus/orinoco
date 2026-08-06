import type { DataPoint } from "../types";
import { config } from "./config";

/**
 * gridSpace.ts
 *
 * Computes the derived grid geometry (display ranges, per-axis scale,
 * MIN_SCALE, and a toRenderSpace function) for a given dataset. This is
 * a pure function, computeGridSpace(points), re-run any time the active
 * dataset changes (see useStore.ts's setDataPoints, which calls this and
 * stores the result for components to read) — so the grid always
 * reflects whatever CSV is currently loaded.
 *
 * GRID_MIN/GRID_MAX/TICK_STEP do not vary per-dataset — the physical
 * box size (-2..2 by default) and tick spacing are deployment-level
 * choices, so they come from config.json's `grid` section rather than
 * from the data.
 */

export const GRID_MIN = config.grid.boxMin;
export const GRID_MAX = config.grid.boxMax;
export const TICK_STEP = config.grid.planeStep;

// Grid margin: each axis extends this fraction beyond the data's
// extremes, so no point ever sits on a wall. Per the spec's worked
// example, at the default 0.1: the tallest invel_pps value
// 3676.470588 * 1.1 = 4044.1176 rounds up (outward) to a wall value
// of 4045.
const MARGIN = config.grid.rangeMargin;

export interface AxisRange {
  min: number;
  max: number;
}

// Which of the 8 octants ("quadrants" in the 3D sense) is isolated, as a
// sign per axis: [1, 1, 1] is the all-positive corner, [-1, 1, -1] is
// negative-x / positive-y / negative-z, and so on. null = show the whole
// grid. Selected from the Toolbar's Isolate page gizmo.
export type OctantSign = [1 | -1, 1 | -1, 1 | -1];

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
  // Render-space coordinate of data-value 0 on each axis — where the three
  // axes cross and the horizontal grid plane sits. With the full symmetric
  // [-M, +M] ranges this is the box center (0, 0, 0); when an octant is
  // isolated the range becomes one-sided ([0, M] or [-M, 0]), so zero moves
  // to that axis's box edge (∓2) and the axes meet at a box corner.
  ZERO_RENDER: { x: number; y: number; z: number };
  // The data-space midpoint each axis's range is centered on — the value
  // that renders at the box center. 0 for the full grid, ±M/2 when
  // isolated. Components that map a data value to render space outside
  // toRenderSpace (e.g. Axes' tick positions) need this.
  CENTER: { x: number; y: number; z: number };
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

// Expands one axis's raw data extent into the SYMMETRIC grid interval it
// will be displayed against — [-M, +M], with data-value 0 at the exact
// center. This is the Desmos-style model: every axis crosses the origin
// and shows both signs, regardless of whether the data is all-positive,
// all-negative, or mixed.
//
// The half-extent M per axis is chosen by the active SCALING MODE:
// - "normalized" (default): per-axis M = farthest-from-zero value on THAT
//   axis, +10%, rounded outward (e.g. |value| 3676.47 -> M = 4045). Each
//   axis fills the box independently against its own extent.
// - "real": one shared M from the farthest value across ALL axes, applied
//   to every axis — so a unit of data is the same render length on every
//   axis (true aspect ratio). A small-range axis's data then bunches near
//   the origin instead of filling the box.
// - "custom": the analyst's typed ± bound per axis (falling back to the
//   normalized auto value for any axis left blank/invalid).
// Degenerate case: an all-zero extent gives M = 0 (divide-by-zero); every
// path floors M at 1 so it still renders a sane [-1, 1].
export type ScalingMode = "normalized" | "real" | "custom";
export interface ScalingConfig {
  mode: ScalingMode;
  // Parsed custom ± bounds per axis; NaN (or <= 0) means "unset", which
  // falls back to the normalized auto value for that axis.
  custom: { x: number; y: number; z: number };
}

// The auto (normalized) half-extent for one axis, from its farthest value.
function autoM(maxAbs: number): number {
  return Math.max(1, Math.ceil(maxAbs * (1 + MARGIN)));
}

// Computes the full GridSpace for a dataset + scaling config. Called
// whenever the dataset OR the scaling mode/custom bounds change (see
// useStore.ts) — NOT on every render.
export function computeGridSpace(
  points: DataPoint[],
  scaling: ScalingConfig,
  isolated: OctantSign | null = null,
): GridSpace {
  const { min, max } = boundingBox(points);
  const absX = Math.max(Math.abs(min.x), Math.abs(max.x));
  const absY = Math.max(Math.abs(min.y), Math.abs(max.y));
  const absZ = Math.max(Math.abs(min.z), Math.abs(max.z));

  let mx: number;
  let my: number;
  let mz: number;
  if (scaling.mode === "real") {
    // One shared extent from the single farthest value across all axes.
    const shared = autoM(Math.max(absX, absY, absZ));
    mx = shared;
    my = shared;
    mz = shared;
  } else if (scaling.mode === "custom") {
    // Use the typed bound where valid (> 0), else fall back to auto.
    const pick = (c: number, absv: number) =>
      Number.isFinite(c) && c > 0 ? c : autoM(absv);
    mx = pick(scaling.custom.x, absX);
    my = pick(scaling.custom.y, absY);
    mz = pick(scaling.custom.z, absZ);
  } else {
    mx = autoM(absX);
    my = autoM(absY);
    mz = autoM(absZ);
  }

  // Full grid: the symmetric [-M, M]. Isolated: only the selected side of
  // each axis ([0, M] or [-M, 0]), which — since the range still maps onto
  // the same fixed box below — is exactly what "enlarges" that octant to
  // fill the whole view.
  const oneSided = (m: number, sign: 1 | -1): AxisRange =>
    sign > 0 ? { min: 0, max: m } : { min: -m, max: 0 };
  const DISPLAY_RANGE = isolated
    ? {
        x: oneSided(mx, isolated[0]),
        y: oneSided(my, isolated[1]),
        z: oneSided(mz, isolated[2]),
      }
    : {
        x: { min: -mx, max: mx },
        y: { min: -my, max: my },
        z: { min: -mz, max: mz },
      };

  const SCALE = {
    x: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.x.max - DISPLAY_RANGE.x.min),
    y: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.y.max - DISPLAY_RANGE.y.min),
    z: (GRID_MAX - GRID_MIN) / (DISPLAY_RANGE.z.max - DISPLAY_RANGE.z.min),
  };

  const MIN_SCALE = Math.min(SCALE.x, SCALE.y, SCALE.z);

  // The data value that renders at the box center: 0 for the full grid
  // (symmetric range), ±M/2 when isolated to one side.
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
  // Where data-zero lands: box center when full, a box edge when isolated.
  const ZERO_RENDER = {
    x: (0 - CENTER.x) * SCALE.x,
    y: (0 - CENTER.y) * SCALE.y,
    z: (0 - CENTER.z) * SCALE.z,
  };
  return {
    DISPLAY_RANGE,
    SCALE,
    MIN_SCALE,
    toRenderSpace,
    ZERO_RENDER,
    CENTER,
  };
}

// Whether a data point falls inside the isolated octant. Values of exactly
// 0 sit on the boundary; they're assigned to the positive side so the 8
// octants partition the data cleanly with no point in two of them.
export function inOctant(
  point: DataPoint,
  octant: OctantSign | null,
): boolean {
  if (!octant) return true;
  return (
    (octant[0] > 0 ? point.x >= 0 : point.x < 0) &&
    (octant[1] > 0 ? point.y >= 0 : point.y < 0) &&
    (octant[2] > 0 ? point.z >= 0 : point.z < 0)
  );
}
