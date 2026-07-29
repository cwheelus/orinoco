import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  type AxisRange,
} from "../lib/gridSpace";
import { useStore } from "../store/useStore";
import { useSceneTheme } from "../hooks/useSceneTheme";

// Axis line + arrowhead styling.
const AXIS_WIDTH = 2;
const ARROW_LEN = 0.16;
const ARROW_RADIUS = 0.045;
const AXIS_TITLE_FONT = 0.18;

// Tick model. Ticks are a FIXED set of nice numbers spanning the whole
// axis [-M, M] (so numbers always run to the axis ends, with no gaps),
// at ~BASE_TICKS_PER_SIDE per side. They do NOT subdivide on zoom — so
// zooming in simply spreads them out on screen and pushes the outer ones
// off the edges (you see fewer), rather than piling on more. Their marks
// and numbers are scaled every frame by camera distance so they stay a
// constant size ON SCREEN instead of ballooning as you approach.
const REF_DIST = 8; // camera distance at which the on-screen scale is 1
const LABEL_FONT = 0.085; // tick-number font size at scale 1 (render units)
const MARK_LEN = 0.05; // tick-mark length at scale 1
const LABEL_OFFSET = 0.17; // number's offset off the axis at scale 1
const MIN_SCREEN_SCALE = 0.15;
const MAX_SCREEN_SCALE = 5;

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
  if (a !== 0 && (a >= 100000 || a < 0.001)) return v.toExponential(1);
  return String(Math.round(v * 1000) / 1000);
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
      titlePos: [MAX + 0.35, zy, zz],
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
      titlePos: [zx, MAX + 0.35, zz],
      tickPos: (p) => [zx, p, zz],
      markEnd: [-MARK_LEN, 0, 0],
      labelPos: [-LABEL_OFFSET - 0.05, 0, 0],
    },
    {
      key: "z",
      line: [
        [zx, zy, MIN],
        [zx, zy, MAX],
      ],
      arrowPos: [zx, zy, MAX + ARROW_LEN / 2],
      arrowRot: [Math.PI / 2, 0, 0],
      titlePos: [zx, zy, MAX + 0.35],
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

  const ticks = useMemo(
    () => ({
      x: axisTicks(DISPLAY_RANGE.x, CENTER.x, SCALE.x, tickDensity),
      y: axisTicks(DISPLAY_RANGE.y, CENTER.y, SCALE.y, tickDensity),
      z: axisTicks(DISPLAY_RANGE.z, CENTER.z, SCALE.z, tickDensity),
    }),
    [DISPLAY_RANGE, CENTER, SCALE, tickDensity],
  );

  const axes = useMemo(
    () => axisDefs(ZERO_RENDER.x, ZERO_RENDER.y, ZERO_RENDER.z),
    [ZERO_RENDER],
  );

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
            <coneGeometry args={[ARROW_RADIUS, ARROW_LEN, 12]} />
            <meshBasicMaterial color={scene.axis} />
          </mesh>
          <Billboard position={ax.titlePos}>
            <Text fontSize={AXIS_TITLE_FONT} color={text.title}>
              {axisLabels[ax.key]}
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
