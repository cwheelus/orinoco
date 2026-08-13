import { useMemo } from "react";
import { Line } from "@react-three/drei";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  TICK_STEP as STEP,
} from "../lib/gridSpace";
import { useStore } from "../store/useStore";
import { useSceneTheme } from "../hooks/useSceneTheme";
import { config } from "../lib/config";

// Opacity is a depth-cue design choice independent of theme — see
// config.json's `grid` section.
const PLANE_OPACITY = config.grid.planeOpacity;
const BOX_OPACITY = config.grid.boxOpacity;

function range(min: number, max: number, step: number): number[] {
  const result: number[] = [];
  for (let v = min; v <= max + 1e-6; v += step) {
    result.push(Math.round(v * 100) / 100);
  }
  return result;
}
const COORDS = range(MIN, MAX, STEP);

const CORNERS = [
  [MIN, MIN, MIN],
  [MAX, MIN, MIN],
  [MAX, MIN, MAX],
  [MIN, MIN, MAX],
  [MIN, MAX, MIN],
  [MAX, MAX, MIN],
  [MAX, MAX, MAX],
  [MIN, MAX, MAX],
] as const;

const BOX_EDGES = [
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
] as const;

// CartesianGrid renders the static 3D reference frame:
//   • A horizontal grid plane at data-zero (y=0), clamped inside the volume
//   • A faint wireframe box showing the [-2, 2]³ bounds
// Coordinate axes, tick marks, and labels live in Axes.tsx — this
// component is only the backdrop. Colors are theme-aware so the grid
// remains visible against both light and dark backgrounds.
export function CartesianGrid() {
  const { scene } = useSceneTheme();

  const zeroY = useStore((state) => state.gridSpace.ZERO_RENDER.y);
  const planeY = Math.min(MAX, Math.max(MIN, zeroY));

  // The bounding box implies real depth on all three axes, which is
  // misleading once the analyst has flattened the view to 2D — see
  // Axes.tsx's is2D, which drives this from the same source (the
  // active column mapping, not the original dataset's shape). Only
  // the box is skipped; the horizontal plane grid still applies to a
  // 2D dataset the same way it does to a 3D one.
  const columnMapping = useStore((state) => state.columnMapping);
  const is2D = columnMapping?.z == null;

  const planeLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    COORDS.forEach((x) => {
      lines.push([
        [x, planeY, MIN],
        [x, planeY, MAX],
      ]);
    });
    COORDS.forEach((z) => {
      lines.push([
        [MIN, planeY, z],
        [MAX, planeY, z],
      ]);
    });
    return lines;
  }, [planeY]);

  return (
    <group>
      {planeLines.map((points, i) => (
        <Line
          key={`plane-${i}`}
          points={points}
          color={scene.gridMajor}
          lineWidth={1}
          transparent
          opacity={PLANE_OPACITY}
        />
      ))}
      {!is2D &&
        BOX_EDGES.map(([a, b], i) => (
          <Line
            key={`box-${i}`}
            points={[CORNERS[a], CORNERS[b]]}
            color={scene.outline}
            lineWidth={1}
            transparent
            opacity={BOX_OPACITY}
          />
        ))}
    </group>
  );
}
