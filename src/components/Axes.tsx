import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  type AxisRange,
} from "../lib/gridSpace";
import { useStore, selectIs2D } from "../store/useStore";
import { useSceneTheme } from "../hooks/useSceneTheme";
import { config } from "../lib/config";
import { truncateLabel } from "../lib/truncateLabel";

// Axis line + arrowhead styling, and the tick model below — all tunable
// via config.json's `axes` section.
const {
  lineWidth: AXIS_WIDTH,
  arrowLength: ARROW_LEN,
  arrowRadius: ARROW_RADIUS,
  arrowSegments: ARROW_SEGMENTS,
  titleFontSize: AXIS_TITLE_FONT,
  // Distance beyond the axis endpoint where the title label sits.
  // Raised from an earlier 0.35 to reduce collisions with longer
  // user-provided CSV column names (for example: "bytes_per_pkt").
  titlePadding: LABEL_PADDING,
  // Tick model. Ticks are a FIXED set of nice numbers spanning the whole
  // axis [-M, M] (so numbers always run to the axis ends, with no gaps),
  // at ~tickDensity per side. They do NOT subdivide on zoom — so zooming
  // in simply spreads them out on screen and pushes the outer ones off
  // the edges (you see fewer), rather than piling on more. Their marks
  // and numbers are scaled every frame by camera distance so they stay a
  // constant size ON SCREEN instead of ballooning as you approach.
  referenceDistance: REF_DIST, // camera distance at which the on-screen scale is 1
  labelFontSize: LABEL_FONT, // tick-number font size at scale 1 (render units)
  markLength: MARK_LEN, // tick-mark length at scale 1
  labelOffset: LABEL_OFFSET, // number's offset off the axis at scale 1
  labelOffsetYExtra: LABEL_OFFSET_Y_EXTRA, // Y's numbers sit beside the axis, so they need a little more room
  minScreenScale: MIN_SCREEN_SCALE,
  maxScreenScale: MAX_SCREEN_SCALE,
} = config.axes;

// Tick-number formatting thresholds: magnitudes at or above
// EXPONENTIAL_ABOVE, or below EXPONENTIAL_BELOW, switch to scientific
// notation rather than printing a wall of digits.
const {
  exponentialAbove: EXPONENTIAL_ABOVE,
  exponentialBelow: EXPONENTIAL_BELOW,
  decimalPlaces: DECIMAL_PLACES,
} = config.axes;
// Precomputed once: rounding to N decimals is round(v * 10^N) / 10^N.
const DECIMAL_FACTOR = Math.pow(10, DECIMAL_PLACES);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Rounds a raw step to the NEAREST "nice" number (1, 2, 5 × 10^k), using
// the standard geometric thresholds, so labels land on human-friendly
// values (…, 100, 200, 500, 1000, …).
function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / base;
  const nice = f < 1.4142 ? 1 : f < 3.1623 ? 2 : f < 7.0711 ? 5 : 10;
  return nice * base;
}

function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a >= EXPONENTIAL_ABOVE || a < EXPONENTIAL_BELOW)) {
    return v.toExponential(1);
  }
  return String(Math.round(v * DECIMAL_FACTOR) / DECIMAL_FACTOR);
}

interface Tick {
  pos: number; // render-space position along the axis
  label: string;
}

// The fixed nice-number ticks for one axis, spanning its display range.
// `density` is the target ticks-per-side (the Grid page slider); the step
// is nice-rounded to roughly hit it. The step comes from the range's SPAN
// rather than a half-extent, so an isolated octant — whose range is
// one-sided and half as wide — automatically gets a step half the size,
// keeping the on-screen tick spacing consistent as the view enlarges.
function axisTicks(
  range: AxisRange,
  center: number,
  scale: number,
  density: number,
): Tick[] {
  const span = range.max - range.min;
  if (!(span > 0) || !(scale > 0)) return [];
  const step = niceStep(span / (2 * density));
  const out: Tick[] = [];
  const kLo = Math.ceil(range.min / step - 1e-9);
  const kHi = Math.floor(range.max / step + 1e-9);
  for (let k = kLo; k <= kHi; k++) {
    if (k === 0) continue; // origin — the axes cross there, no tick/number
    const v = k * step;
    out.push({ pos: (v - center) * scale, label: formatTick(v) });
  }
  return out;
}

const scratchPivot = new THREE.Vector3();

// Per-axis geometry: how the line runs, where the arrowhead/title sit, and
// how a tick at render position `p` places its mark + number off the axis.
type AxisDef = {
  key: "x" | "y" | "z";
  line: [[number, number, number], [number, number, number]];
  arrowPos: [number, number, number];
  arrowRot: [number, number, number];
  titlePos: [number, number, number];
  tickPos: (p: number) => [number, number, number];
  markEnd: [number, number, number];
  labelPos: [number, number, number];
};

// Builds the three axis definitions crossing at (zx, zy, zz) — the render
// position of data-zero. That's the box center for the full grid, and a box
// corner when an octant is isolated, so the axes stay pinned to true zero
// either way instead of assuming the middle of the box.
function axisDefs(zx: number, zy: number, zz: number): AxisDef[] {
  return [
    {
      key: "x",
      line: [
        [MIN, zy, zz],
        [MAX, zy, zz],
      ],
      arrowPos: [MAX + ARROW_LEN / 2, zy, zz],
      arrowRot: [0, 0, -Math.PI / 2],
      titlePos: [MAX + LABEL_PADDING, zy, zz],
      tickPos: (p) => [p, zy, zz],
      markEnd: [0, -MARK_LEN, 0],
      labelPos: [0, -LABEL_OFFSET, 0],
    },
    {
      key: "y",
      line: [
        [zx, MIN, zz],
        [zx, MAX, zz],
      ],
      arrowPos: [zx, MAX + ARROW_LEN / 2, zz],
      arrowRot: [0, 0, 0],
      titlePos: [zx, MAX + LABEL_PADDING, zz],
      tickPos: (p) => [zx, p, zz],
      markEnd: [-MARK_LEN, 0, 0],
      labelPos: [-LABEL_OFFSET - LABEL_OFFSET_Y_EXTRA, 0, 0],
    },
    {
      key: "z",
      line: [
        [zx, zy, MIN],
        [zx, zy, MAX],
      ],
      arrowPos: [zx, zy, MAX + ARROW_LEN / 2],
      arrowRot: [Math.PI / 2, 0, 0],
      titlePos: [zx, zy, MAX + LABEL_PADDING],
      tickPos: (p) => [zx, zy, p],
      markEnd: [0, -MARK_LEN, 0],
      labelPos: [0, -LABEL_OFFSET, 0],
    },
  ];
}

// Axes draws the three coordinate axes Desmos-style — each through the
// centered origin with an arrowhead + column-name title — plus a fixed
// set of nice-number ticks along the whole axis. The tick marks/numbers
// are scaled every frame by camera distance so they read at a constant
// on-screen size (zooming in spreads the ticks apart and takes the outer
// ones off-screen, rather than crowding more in).
export function Axes() {
  const { scene, text } = useSceneTheme();
  const { camera } = useThree();
  const { SCALE, DISPLAY_RANGE, CENTER, ZERO_RENDER } = useStore(
    (state) => state.gridSpace,
  );
  const axisLabels = useStore((state) => state.axisLabels);
  const hiddenTickAxes = useStore((state) => state.hiddenTickAxes);
  const tickDensity = useStore((state) => state.tickDensity);
  const setHoveredAxis = useStore((state) => state.setHoveredAxis);

  const ticks = useMemo(
    () => ({
      x: axisTicks(DISPLAY_RANGE.x, CENTER.x, SCALE.x, tickDensity),
      y: axisTicks(DISPLAY_RANGE.y, CENTER.y, SCALE.y, tickDensity),
      z: axisTicks(DISPLAY_RANGE.z, CENTER.z, SCALE.z, tickDensity),
    }),
    [DISPLAY_RANGE, CENTER, SCALE, tickDensity],
  );

  // Hide the Z axis whenever no Z column is currently selected. This
  // includes both datasets that have no Z dimension and datasets that
  // the user has intentionally flattened by choosing "None" for Z.
  // Filtering it out of `axes` here means the line, arrow, title, and
  // ticks below all skip Z automatically — nothing else in this file
  // needs its own dimension check.
  //
  // Read through selectIs2D rather than testing `columnMapping?.z`
  // directly: an ABSENT mapping means no dataset has loaded yet, which
  // is not the same as a 2D one (#62/#63). The two used to agree in
  // practice because a dataset was auto-loaded on mount, so the null
  // window lasted a single tick; with the app now opening empty (#57)
  // that window is however long the analyst takes to pick a file, and
  // the local test would render the empty grid as a flat 2D plane.
  const is2D = useStore(selectIs2D);
  const axes = useMemo(() => {
    const all = axisDefs(ZERO_RENDER.x, ZERO_RENDER.y, ZERO_RENDER.z);
    return is2D ? all.filter((ax) => ax.key !== "z") : all;
  }, [ZERO_RENDER, is2D]);

  // Collected every render; each tick's group is scaled per-frame below to
  // keep its mark + number a constant size on screen.
  const tickGroups = useRef<THREE.Group[]>([]);
  tickGroups.current = [];

  useFrame(() => {
    const pivot = useStore.getState().pivot;
    scratchPivot.set(pivot[0], pivot[1], pivot[2]);
    const dist = camera.position.distanceTo(scratchPivot);
    const s = clamp(dist / REF_DIST, MIN_SCREEN_SCALE, MAX_SCREEN_SCALE);
    for (const g of tickGroups.current) g.scale.setScalar(s);
  });

  return (
    <group>
      {axes.map((ax) => (
        <group key={ax.key}>
          <Line points={ax.line} color={scene.axis} lineWidth={AXIS_WIDTH} />
          <mesh position={ax.arrowPos} rotation={ax.arrowRot}>
            <coneGeometry args={[ARROW_RADIUS, ARROW_LEN, ARROW_SEGMENTS]} />
            <meshBasicMaterial color={scene.axis} />
          </mesh>
          <Billboard position={ax.titlePos}>
            {/* Truncated per Charles/Eric's #59 spec — full name shown
                via App.tsx's HTML tooltip on hover (hoveredAxis in the
                store), since drei's Text has no native DOM title. */}
            <Text
              fontSize={AXIS_TITLE_FONT}
              color={text.title}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredAxis(ax.key);
              }}
              onPointerOut={() => setHoveredAxis(null)}
            >
              {truncateLabel(axisLabels[ax.key])}
            </Text>
          </Billboard>
          {!hiddenTickAxes.includes(ax.key) &&
            ticks[ax.key].map((t) => (
              // Group is anchored at the tick's point on the axis; its
              // local mark + label are scaled together per-frame (above)
              // so both stay constant on screen and keep their spacing.
              <group
                key={t.pos}
                position={ax.tickPos(t.pos)}
                ref={(el) => {
                  if (el) tickGroups.current.push(el);
                }}
              >
                <Line
                  points={[[0, 0, 0], ax.markEnd]}
                  color={scene.tick}
                  lineWidth={1}
                />
                <Billboard position={ax.labelPos}>
                  <Text fontSize={LABEL_FONT} color={text.label}>
                    {t.label}
                  </Text>
                </Billboard>
              </group>
            ))}
        </group>
      ))}
    </group>
  );
}
