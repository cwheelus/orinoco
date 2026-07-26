import { Line } from "@react-three/drei";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  TICK_STEP as STEP,
} from "../lib/gridSpace";
import { useStore } from "../store/useStore";
// Cartesian grid bounds come from lib/gridSpace.ts, the single source of
// truth shared with Axes.tsx (ticks/labels) and PointCloud.tsx (data
// normalization) — all three axes run -2 to 2, with a gridline every 0.5
// units (matching the tick spacing in Axes.tsx).
const GRID_COLOR = "#3a4a6b";
const GRID_OPACITY = 0.35;
// The zero-anchored plane gets its own color (a muted green, distinct
// from the blue-gray box) and slightly higher opacity — it's a semantic
// reference ("this is where data-value 0 lives"), not part of the
// structural box, and needs to read as such at a glance.
const ZERO_PLANE_COLOR = "#2d6b4a";
const ZERO_PLANE_OPACITY = 0.5;

// Builds an evenly spaced array from min to max, inclusive, at the given
// step (e.g. -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2). This gives us every
// coordinate where a gridline should be drawn.
function range(min: number, max: number, step: number) {
  const values: number[] = [];
  for (let v = min; v <= max + 1e-6; v += step) {
    values.push(Math.round(v * 100) / 100);
  }
  return values;
}

const COORDS = range(MIN, MAX, STEP);

// CartesianGrid renders an OPEN 3-sided box (floor + two back walls),
// not a fully enclosed 6-face cube. Per Charles's feedback in the 7/13
// meeting ("hard to conceptualize what you're seeing without the axes"),
// a fully enclosed box obscures the view from every angle — an open box
// still gives spatial reference while letting the viewer see straight
// into the data from the front and right side.
//
// Each gridline is a separate <Line> component (drei's wrapper around a
// Three.js line primitive), built from a pair of 3D start/end points.
// We collect every line into a single `lines` array first, then render
// them all in one pass at the bottom — this keeps the coordinate math
// separate from the actual JSX output.
export function CartesianGrid() {
  // Which grid layout mode is active — "zero-plane" adds a horizontal
  // reference plane at data-value 0's render height (see below).
  const gridMode = useStore((state) => state.gridMode);
  // ZERO_RENDER.y: where data-value 0 sits in render space on the
  // vertical axis, clamped to [MIN, MAX] — computed per-dataset in
  // lib/gridSpace.ts alongside the rest of the grid geometry.
  const { ZERO_RENDER } = useStore((state) => state.gridSpace);
  const lines: [number, number, number][][] = [];

  // Floor: Y = MIN (the bottom of the box). One set of lines runs along
  // X (fixed z, varying x), the other along Z (fixed x, varying z) —
  // together they form a checkerboard-style floor grid.
  COORDS.forEach((x) => {
    lines.push([
      [x, MIN, MIN],
      [x, MIN, MAX],
    ]);
  });
  COORDS.forEach((z) => {
    lines.push([
      [MIN, MIN, z],
      [MAX, MIN, z],
    ]);
  });

  // Back wall #1: X = MIN (the left side of the box, viewed from the
  // default camera angle). Lines run along Y (vertical) and Z (depth).
  COORDS.forEach((y) => {
    lines.push([
      [MIN, y, MIN],
      [MIN, y, MAX],
    ]);
  });
  COORDS.forEach((z) => {
    lines.push([
      [MIN, MIN, z],
      [MIN, MAX, z],
    ]);
  });

  // Back wall #2: Z = MIN (the back side of the box). Lines run along
  // X (width) and Y (vertical).
  COORDS.forEach((x) => {
    lines.push([
      [x, MIN, MIN],
      [x, MAX, MIN],
    ]);
  });
  COORDS.forEach((y) => {
    lines.push([
      [MIN, y, MIN],
      [MAX, y, MIN],
    ]);
  });
  // Zero plane (zero-plane mode only): a horizontal grid of lines at
  // data-value 0's render height, same checkerboard pattern as the
  // floor. Collected into its OWN array (not `lines`) because it
  // renders with its own color/opacity. Skipped when zero coincides
  // with the floor (ZERO_RENDER.y === MIN, i.e. all-positive data —
  // axisRange anchors those at 0, so the floor already IS the zero
  // plane) to avoid drawing identical lines twice in the same spot.
  // The all-negative case (zero clamped to MAX, the ceiling) DOES
  // draw — the open box has no ceiling, so there's nothing to
  // double-draw against, and the plane is genuinely informative there.
  const zeroPlaneLines: [number, number, number][][] = [];
  if (gridMode === "zero-plane" && ZERO_RENDER.y > MIN) {
    const zy = ZERO_RENDER.y;
    COORDS.forEach((x) => {
      zeroPlaneLines.push([
        [x, zy, MIN],
        [x, zy, MAX],
      ]);
    });
    COORDS.forEach((z) => {
      zeroPlaneLines.push([
        [MIN, zy, z],
        [MAX, zy, z],
      ]);
    });
  }
  return (
    <group>
      {/* Render every line collected above. `key={i}` is required by
          React whenever mapping an array to a list of elements, so each
          <Line> can be tracked individually across re-renders. Index is
          safe to use as a key here since `lines` is rebuilt fresh on
          every render and never reordered. */}
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={GRID_COLOR}
          lineWidth={1}
          transparent
          opacity={GRID_OPACITY}
        />
      ))}
      {/* Zero-plane lines (empty array unless zero-plane mode is
          active — see the geometry block above). Keyed with a "zero-"
          prefix so they can't collide with the box lines' index keys. */}
      {zeroPlaneLines.map((points, i) => (
        <Line
          key={`zero-${i}`}
          points={points}
          color={ZERO_PLANE_COLOR}
          lineWidth={1}
          transparent
          opacity={ZERO_PLANE_OPACITY}
        />
      ))}
    </group>
  );
}
