import { Billboard, Line, Text } from "@react-three/drei";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  TICK_STEP,
  type AxisRange,
} from "../lib/gridSpace";
import { useStore } from "../store/useStore";

const TICK_LEN = 0.06;

function range(min: number, max: number, step: number) {
  const values: number[] = [];
  for (let v = min; v <= max + 1e-6; v += step) {
    values.push(Math.round(v * 10) / 10);
  }
  return values;
}

const TICKS = range(MIN, MAX, TICK_STEP);

function tickLabel(t: number, range: AxisRange): string {
  const fraction = (t - MIN) / (MAX - MIN);
  return (range.min + fraction * (range.max - range.min)).toFixed(1);
}

// Axes draws tick marks, numeric labels, and axis name labels along the
// OUTER EDGES of the Cartesian grid box (built separately in
// CartesianGrid.tsx) for X and Z — not through the center. This matches
// the box's open-face design: the floor and two back walls meet at the
// corner where x=MIN, y=MIN, z=MIN.
//
// EXPERIMENTAL: the Y axis (vertical/height) is drawn differently from
// X and Z — as a single line running through the CENTER of the floor
// plane (render x=0, z=0), extending the full MIN..MAX height range,
// with its own ticks on both sides. This is a Desmos-style hybrid:
// X/Z stay on the box edges (where they're most legible against a
// point cloud), but Y runs through the middle, similar to how Desmos's
// 3D grapher draws its vertical axis through the origin. Not yet
// decided as a final design — pending team discussion on whether this
// visual style fits a security-analysis tool vs. a graphing-calculator
// aesthetic.
//
// Each axis TITLE (as opposed to its numeric ticks) is deliberately
// positioned well past the last tick in its run, rather than at the
// midpoint — the midpoint coincides with the middle tick's exact
// coordinate, which caused the title text to render directly on top
// of that tick's number. A larger +0.8 offset (rather than a smaller
// one) was needed because the title renders at 2x the tick text's
// font size — a small offset technically avoids exact overlap but
// isn't enough visual clearance once the larger glyphs are accounted
// for.
//
// NOTE: a camera-angle-aware version (repositioning titles dynamically
// based on which end of the axis the camera is currently facing) was
// tried and reverted — the discrete switch between two preset
// positions produced a visible jump/pop as the camera crossed the
// midpoint, which was worse than the static version's imperfect (but
// stable) placement. Static positioning is not fully collision-free
// from every possible camera angle, but is the more usable tradeoff
// for now.
export function Axes() {
  const { DISPLAY_RANGE } = useStore((state) => state.gridSpace);
  const axisLabels = useStore((state) => state.axisLabels);

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
      {/* Y Axis (EXPERIMENTAL) — a single vertical line through the
          center of the floor plane (render x=0, z=0), rather than the
          box's front-left corner edge. Ticks extend outward from the
          line on both sides (alternating left/right by index) so
          numbers don't stack directly on top of each other along a
          single line. */}
      <Line
        points={[
          [0, MIN, 0],
          [0, MAX, 0],
        ]}
        color="#999999"
        lineWidth={1}
      />
      {TICKS.map((t, i) => {
        // Alternate which side each tick's number renders on, purely
        // so consecutive tick labels don't overlap each other along
        // a single vertical line — with only one line (rather than an
        // edge to spread ticks along), every tick's text would
        // otherwise stack in the same horizontal position.
        const side = i % 2 === 0 ? 1 : -1;
        return (
          <group key={`y-tick-${t}`}>
            <Line
              points={[
                [0, t, 0],
                [side * TICK_LEN * 3, t, 0],
              ]}
              color="#999999"
              lineWidth={1}
            />
            <Billboard position={[side * 0.3, t, 0]}>
              <Text {...tickLabelProps}>{tickLabel(t, DISPLAY_RANGE.y)}</Text>
            </Billboard>
          </group>
        );
      })}
      <Billboard position={[0, MAX + 0.8, 0]}>
        <Text {...axisLabelProps}>{axisLabels.y}</Text>
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
            <Text {...tickLabelProps}>{tickLabel(t, DISPLAY_RANGE.x)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[MAX + 0.8, MIN - 0.55, MAX]}>
        <Text {...axisLabelProps}>{axisLabels.x}</Text>
      </Billboard>

      {TICKS.map((t) => (
        <group key={`z-tick-${t}`}>
          <Line
            points={[
              [MAX + TICK_LEN, MIN, t],
              [MAX, MIN, t],
            ]}
            color="#999999"
            lineWidth={1}
          />
          <Billboard position={[MAX + 0.3, MIN, t]}>
            <Text {...tickLabelProps}>{tickLabel(t, DISPLAY_RANGE.z)}</Text>
          </Billboard>
        </group>
      ))}
      <Billboard position={[MAX + 1, MIN, MAX + 0.8]}>
        <Text {...axisLabelProps}>{axisLabels.z}</Text>
      </Billboard>
    </group>
  );
}
