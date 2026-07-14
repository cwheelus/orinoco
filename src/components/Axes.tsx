import { Billboard, Line, Text } from "@react-three/drei";

// Cartesian bounds and tick spacing — must match CartesianGrid.tsx.
// These values come directly from the project spec: all three axes run
// -2 to 2, with a labeled tick every 0.5 units.
const MIN = -2;
const MAX = 2;
const TICK_STEP = 0.5;
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
            <Text {...tickLabelProps}>{t.toFixed(1)}</Text>
          </Billboard>
        </group>
      ))}
      {/* Axis name label, positioned just past the top tick. This edge
          (x=MIN, z=MAX) was chosen over the equally valid back corner
          (x=MIN, z=MIN) because it sits closer to the default camera
          position, making it easier to read without rotating the scene. */}
      <Billboard position={[MIN - 0.55, 0, MAX]}>
        <Text {...axisLabelProps}>in-entropy</Text>
      </Billboard>

      {/* X Axis (in-conv) — bottom edge where the floor meets the back
          wall, at y=MIN, z=MIN. Same tick-per-value pattern as above,
          but the line varies in x while y and z stay fixed at the edge. */}
      {TICKS.map((t) => (
        <group key={`x-tick-${t}`}>
          <Line
            points={[
              [t, MIN - TICK_LEN, MIN],
              [t, MIN, MIN],
            ]}
            color="#999999"
            lineWidth={1}
          />
          <Billboard position={[t, MIN - 0.3, MIN]}>
            <Text {...tickLabelProps}>{t.toFixed(1)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[0, MIN - 0.55, MIN]}>
        <Text {...axisLabelProps}>in-conv</Text>
      </Billboard>

      {/* Z Axis (in-WHT-score) — bottom edge where the floor meets the
          left wall, at y=MIN, x=MIN. Line varies in z while x and y
          stay fixed at the edge. */}
      {TICKS.map((t) => (
        <group key={`z-tick-${t}`}>
          <Line
            points={[
              [MIN, MIN - TICK_LEN, t],
              [MIN, MIN, t],
            ]}
            color="#999999"
            lineWidth={1}
          />
          <Billboard position={[MIN, MIN - 0.3, t]}>
            <Text {...tickLabelProps}>{t.toFixed(1)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[MIN, MIN - 0.55, 0]}>
        <Text {...axisLabelProps}>in-WHT-score</Text>
      </Billboard>
    </group>
  );
}
