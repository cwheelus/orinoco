import { Line } from "@react-three/drei";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  TICK_STEP as STEP,
} from "../lib/gridSpace";
import { useStore } from "../store/useStore";

// The horizontal grid plane (the y=0 plane the axes cross) reads a touch
// brighter than the enclosing box, which is just a faint depth reference.
const PLANE_COLOR = "#3a4a6b";
const PLANE_OPACITY = 0.35;
const BOX_COLOR = "#2a3550";
const BOX_OPACITY = 0.4;

// Every coordinate where a plane gridline sits (-2, -1.5, ... 2).
function range(min: number, max: number, step: number) {
  const values: number[] = [];
  for (let v = min; v <= max + 1e-6; v += step) {
    values.push(Math.round(v * 100) / 100);
  }
  return values;
}
const COORDS = range(MIN, MAX, STEP);

// The 8 corners of the [-2,2]^3 box and the 12 edges connecting them,
// as index pairs — used to draw a faint full wireframe cube for depth
// reference (Desmos-style), rather than the older open 3-wall box.
const CORNERS: [number, number, number][] = [
  [MIN, MIN, MIN],
  [MAX, MIN, MIN],
  [MAX, MIN, MAX],
  [MIN, MIN, MAX],
  [MIN, MAX, MIN],
  [MAX, MAX, MIN],
  [MAX, MAX, MAX],
  [MIN, MAX, MAX],
];
const BOX_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0], // bottom face
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4], // top face
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7], // verticals
];

// CartesianGrid draws the Desmos-style reference frame: a single
// horizontal grid plane through the origin (the y=0 plane), plus a faint
// full wireframe box around the whole volume. The bold coordinate axes
// and tick numbers live in Axes.tsx; this component is purely the passive
// grid/box backdrop.
export function CartesianGrid() {
  // Height of the plane: wherever data-value 0 lands on the vertical axis.
  // That's the box center for the full grid; when an octant is isolated the
  // range is one-sided, so zero sits on the box floor or ceiling instead.
  // Clamped so it can never be drawn outside the box.
  const zeroY = useStore((state) => state.gridSpace.ZERO_RENDER.y);
  const planeY = Math.min(MAX, Math.max(MIN, zeroY));

  // Horizontal plane at data-zero: one set of lines along X (fixed z), one
  // along Z (fixed x) — a flat checkerboard the data straddles.
  const planeLines: [number, number, number][][] = [];
  COORDS.forEach((x) => {
    planeLines.push([
      [x, planeY, MIN],
      [x, planeY, MAX],
    ]);
  });
  COORDS.forEach((z) => {
    planeLines.push([
      [MIN, planeY, z],
      [MAX, planeY, z],
    ]);
  });

  return (
    <group>
      {planeLines.map((points, i) => (
        <Line
          key={`plane-${i}`}
          points={points}
          color={PLANE_COLOR}
          lineWidth={1}
          transparent
          opacity={PLANE_OPACITY}
        />
      ))}
      {BOX_EDGES.map(([a, b], i) => (
        <Line
          key={`box-${i}`}
          points={[CORNERS[a], CORNERS[b]]}
          color={BOX_COLOR}
          lineWidth={1}
          transparent
          opacity={BOX_OPACITY}
        />
      ))}
    </group>
  );
}
