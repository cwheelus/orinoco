import { Billboard, Line, Text } from "@react-three/drei";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  TICK_STEP,
  DISPLAY_BOUND,
} from "../lib/gridSpace";

// Cartesian bounds and tick spacing come from lib/gridSpace.ts, the single
// source of truth shared with CartesianGrid.tsx (box geometry) and
// PointCloud.tsx (data normalization) — all three axes run -2 to 2, with a
// labeled tick every 0.5 units.
const TICK_LEN = 0.06; // length of each tick mark, in 3D units

// Builds an evenly spaced array of tick positions from min to max
// (e.g. -2.0, -1.5, -1.0 ... up to 2.0). Computed once at module load
// rather than on every render, since the bounds never change.
function range(min: number, max: number, step: number) {
  const values: number[] = [];
  for (let v = min; v <= max + 1e-6; v += step) {
    // Rounds off floating-point drift (e.g. 0.7999999999 -> 0.8)
    values.push(Math.round(v * 10) / 10);
  }
  return values;
}

const TICKS = range(MIN, MAX, TICK_STEP);

// Converts a tick's fixed render-space position (always -2..2, regardless
// of dataset) into the real data-space number it should display — a tick
// at the box's outer wall (t === MAX) shows `bound` itself, one at the
// center (t === 0) shows 0, and everything in between is a linear
// interpolation. `bound` is DISPLAY_BOUND.x/y/z (per lib/gridSpace.ts) for
// whichever axis this tick belongs to — each axis now scales
// independently, so each has its own real-world magnitude to display
// instead of a single shared one.
function tickLabel(t: number, bound: number): string {
  return ((t / MAX) * bound).toFixed(1);
}

// Axes draws tick marks, numeric labels, and axis name labels along the
// OUTER EDGES of the Cartesian grid box (built separately in
// CartesianGrid.tsx) — not through the center. This matches the box's
// open-face design: the floor and two back walls meet at the corner
// where x=MIN, y=MIN, z=MIN.
//
// Each tick is rendered as a <Line> (a short mark perpendicular to the
// edge) paired with a <Text> label. <Billboard> wraps every label because
// 3D text otherwise stays fixed to its original rotation — as the camera
// orbits, flat text would appear edge-on and unreadable from many angles.
// Billboard automatically re-orients the text to always face the camera.
export function Axes() {
  const tickLabelProps = {
    fontSize: 0.1,
    color: "#cccccc",
  };

  const axisLabelProps = {
    fontSize: 0.2,
    color: "white",
  };

  return (
    <group>
      {/* Y Axis (in-entropy) — front-left outer edge, at x=MIN, z=MAX.
          We loop over TICKS and render one <group> per tick value `t`,
          each containing a small line (the tick mark) and a text label
          (the number). `key` is required by React whenever rendering a
          list of elements from an array, so it can track each one
          individually across re-renders. */}
      {TICKS.map((t) => (
        <group key={`y-tick-${t}`}>
          {/* A short horizontal line crossing the vertical edge at
              height t — x and z stay fixed at the edge's position,
              only the tick's own start/end x shifts slightly to make
              a visible mark. */}
          <Line
            points={[
              [MIN - TICK_LEN, t, MAX],
              [MIN, t, MAX],
            ]}
            color="#999999"
            lineWidth={1}
          />
          <Billboard position={[MIN - 0.3, t, MAX]}>
            <Text {...tickLabelProps}>{tickLabel(t, DISPLAY_BOUND.y)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[MIN - 1, 0, MAX]}>
        <Text {...axisLabelProps}>in-entropy</Text>
      </Billboard>

      {TICKS.map((t) => (
        <group key={`x-tick-${t}`}>
          <Line
            points={[
              [t, MIN - TICK_LEN, MAX],
              [t, MIN, MAX],
            ]}
            color="#999999"
            lineWidth={1}
          />
          <Billboard position={[t, MIN - 0.3, MAX]}>
            <Text {...tickLabelProps}>{tickLabel(t, DISPLAY_BOUND.x)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[0, MIN - 0.55, MAX]}>
        <Text {...axisLabelProps}>in-conv</Text>
      </Billboard>

      {TICKS.map((t) => (
        <group key={`z-tick-${t}`}>
          <Line
            points={[
              [MAX+TICK_LEN, MIN, t],
              [MAX, MIN, t],
            ]}
            color="#999999"
            lineWidth={1}
          />
          <Billboard position={[MAX + 0.3,  MIN, t]}>
            <Text {...tickLabelProps}>{tickLabel(t, DISPLAY_BOUND.z)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[MAX + 1, MIN, 0]}>
        <Text {...axisLabelProps}>in-WHT-score</Text>
      </Billboard>
    </group>
  );
}
