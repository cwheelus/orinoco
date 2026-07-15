import data from "../data.json";

// Single source of truth for the Cartesian plotting volume. CartesianGrid.tsx
// (box geometry) and Axes.tsx (ticks/labels) both import these instead of
// each hardcoding their own copy — previously the two files duplicated
// MIN/MAX/STEP and relied on comments telling each other to stay in sync.
export const GRID_MIN = -2;
export const GRID_MAX = 2;
export const TICK_STEP = 0.5;

// Fraction of the box's half-extent that data is scaled to fill, leaving a
// visible margin so no point sits flush against a wall.
const PADDING = 0.9;

// Half-width of the target box (e.g. -2..2 has half-extent 2).
const GRID_HALF_EXTENT = (GRID_MAX - GRID_MIN) / 2;

// Below this, a dataset's spread is treated as zero (a single point, or
// every point sharing the same coordinates on every axis). Guards against
// dividing by ~0 and producing a huge or infinite scale factor.
const MIN_EXTENT = 1e-6;

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

// The midpoint of the data's bounding box mapped to the world origin,
// this is what keeps the visualization centered on wherever the data
// actually sits, rather than on the fixed point (0,0,0), which could be
// far outside the data entirely.
const CENTER = {
  x: (min.x + max.x) / 2,
  y: (min.y + max.y) / 2,
  z: (min.z + max.z) / 2,
};

// Half-extent of the data's bounding box, per axis. Each axis gets its own
// independent scale factor (below) rather than one shared factor — chosen
// because the real dataset's three columns (byte counts, packet rates,
// bytes-per-packet) live on wildly different magnitudes, and a single
// shared scale factor (picked from the widest axis) squashed the other two
// axes into a nearly flat sliver. The tradeoff: with independent per-axis
// scaling, relative distances *across* axes are no longer directly
// comparable (a cluster that looks tight on one axis and wide on another
// may just be a scaling artifact, not a real difference in spread) — but
// each axis now uses the full box, which is what's needed for typing this
// dataset's actual shape.
const halfExtent = {
  x: (max.x - min.x) / 2,
  y: (max.y - min.y) / 2,
  z: (max.z - min.z) / 2,
};

// Maps a single axis's half-extent to fill PADDING of the box's
// half-extent. Datasets that are naturally tight on this axis get scaled
// up to use the available space; datasets with a wide spread on this axis
// get scaled down to fit — the box itself never changes size, only how
// much of it a given axis uses.
//
// Degenerate case: if every point shares (or nearly shares) the same value
// on this axis, extent is ~0, which would otherwise divide by zero.
// Falling back to a scale of 1 is safe here because (point - CENTER) is
// already ~0 for every point on this axis in that case, so the scale
// factor has no visible effect.
function axisScale(extent: number): number {
  return extent < MIN_EXTENT ? 1 : (GRID_HALF_EXTENT * PADDING) / extent;
}

export const SCALE = {
  x: axisScale(halfExtent.x),
  y: axisScale(halfExtent.y),
  z: axisScale(halfExtent.z),
};

// The smallest of the three per-axis scale factors — i.e. the axis that
// got compressed the hardest to fit the box. Used by PointCloud.tsx to
// size point spheres: sizing off the most-compressed axis (rather than an
// average) keeps balls from looking oversized relative to whichever
// dimension packed points closest together.
export const MIN_SCALE = Math.min(SCALE.x, SCALE.y, SCALE.z);

// The real data-space value that this axis's outer wall (GRID_MAX)
// represents, given the same margin baked into this axis's SCALE above —
// i.e. the inverse of axisScale, so tick labels can show actual data
// magnitudes instead of always reading the fixed "-2..2" render-space
// numbers regardless of what's loaded. Rounded outward (away from zero) to
// the nearest whole number for a clean, readable axis — the exact
// fractional bound isn't meaningful to a viewer, a round number is.
// Floored at 1 so an axis with ~0 spread still shows a sensible (if
// arbitrary) scale rather than "0" at every tick.
function axisDisplayBound(extent: number): number {
  return Math.max(1, Math.ceil(extent / PADDING));
}

export const DISPLAY_BOUND = {
  x: axisDisplayBound(halfExtent.x),
  y: axisDisplayBound(halfExtent.y),
  z: axisDisplayBound(halfExtent.z),
};

// Converts a raw data point into the position it should be rendered at
// inside the fixed -2..2 box, scaling each axis independently. This is
// purely a rendering-space transform — the point passed in is never
// mutated, so anything reading the source data directly (the HUD's point
// inspector, for example) continues to see the true, un-normalized values
// for analysis.
export function toRenderSpace(point: RawPoint): [number, number, number] {
  return [
    (point.x - CENTER.x) * SCALE.x,
    (point.y - CENTER.y) * SCALE.y,
    (point.z - CENTER.z) * SCALE.z,
  ];
}
