import { Line } from "@react-three/drei";
import { GRID_MIN as MIN, GRID_MAX as MAX, TICK_STEP as STEP } from "../lib/gridSpace";

// Cartesian grid bounds come from lib/gridSpace.ts, the single source of
// truth shared with Axes.tsx (ticks/labels) and PointCloud.tsx (data
// normalization) — all three axes run -2 to 2, with a gridline every 0.5
// units (matching the tick spacing in Axes.tsx).
const GRID_COLOR = "#3a4a6b";
const GRID_OPACITY = 0.35;

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
    </group>
  );
}
