import { useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import type { OctantSign } from "../store/useStore";
import { cameraOrientation } from "../lib/cameraSync";

// Gizmo layout, in the widget canvas's own units (nothing here relates to
// the main scene's -2..2 render space).
const CUBE = 0.62; // edge length of each of the 8 octant cubes
const GAP = 0.09; // space between them, so each is separately clickable
const OFFSET = (CUBE + GAP) / 2; // center distance of a cube from the middle
// Half-extent of the click-to-reset outline. The 0.65 pulls it in by 35%
// from the natural cube-cluster-plus-padding size, which is what keeps the
// whole outline (corners included) inside the widget's viewport instead of
// running off its edges. It still clears the cube cluster's own half-extent
// (OFFSET + CUBE/2 ≈ 0.67), so the band between the cubes and the outline
// that reverts to the full grid stays comfortably clickable.
const OUTLINE = (OFFSET * 2 + CUBE / 2 + 0.3) * 0.65;

const IDLE_COLOR = "#4a5878";
const HOVER_COLOR = "#6b83b8";
const ACTIVE_COLOR = "#3b82f6";
const OUTLINE_COLOR = "#5c6a8a";

// The 8 octants as sign triples. Order is irrelevant to behavior — each
// cube is positioned from its own signs — but keeping it stable makes the
// rendered list predictable.
const OCTANTS: OctantSign[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [1, -1, -1],
  [-1, -1, -1],
];

function sameOctant(a: OctantSign | null, b: OctantSign): boolean {
  return !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// The 12 edges of the outline cube, as corner-index pairs.
const OUTLINE_CORNERS: [number, number, number][] = [
  [-OUTLINE, -OUTLINE, -OUTLINE],
  [OUTLINE, -OUTLINE, -OUTLINE],
  [OUTLINE, -OUTLINE, OUTLINE],
  [-OUTLINE, -OUTLINE, OUTLINE],
  [-OUTLINE, OUTLINE, -OUTLINE],
  [OUTLINE, OUTLINE, -OUTLINE],
  [OUTLINE, OUTLINE, OUTLINE],
  [-OUTLINE, OUTLINE, OUTLINE],
];
const OUTLINE_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

// The rotating contents of the gizmo. Kept as its own component so it can
// use useFrame (only valid inside a Canvas).
function GizmoScene() {
  const isolatedOctant = useStore((state) => state.isolatedOctant);
  const setIsolatedOctant = useStore((state) => state.setIsolatedOctant);
  const groupRef = useRef<THREE.Group>(null);
  const hoveredRef = useRef<THREE.Mesh | null>(null);

  // Mirror the main camera's angle. The gizmo's own camera is fixed, so
  // applying the INVERSE of the main camera's rotation to the model makes
  // the cube present the same face the main grid currently presents —
  // rotate the grid and this turns with it.
  useFrame(() => {
    groupRef.current?.quaternion.copy(cameraOrientation).invert();
  });

  const setHover = (mesh: THREE.Mesh | null) => {
    hoveredRef.current = mesh;
    document.body.style.cursor = mesh ? "pointer" : "";
  };

  return (
    <group ref={groupRef}>
      {/* Click target for "inside the outline but not on a cube" → revert
          to the full grid. Invisible via opacity 0 rather than
          visible={false}, which would stop it being raycast at all.
          side=BackSide is what makes the ordering work: rendering only the
          box's FAR faces puts them behind the cubes in hit order, so a
          click on a cube reaches the cube first and its stopPropagation
          suppresses this handler. With the default FrontSide the near face
          would be hit first and every cube click would fire a reset before
          the isolate, double-firing the store and the transition. */}
      <mesh
        onClick={() => setIsolatedOctant(null)}
        onPointerOver={() => setHover(null)}
      >
        <boxGeometry args={[OUTLINE * 2, OUTLINE * 2, OUTLINE * 2]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {OUTLINE_EDGES.map(([a, b], i) => (
        <Line
          key={`edge-${i}`}
          points={[OUTLINE_CORNERS[a], OUTLINE_CORNERS[b]]}
          color={OUTLINE_COLOR}
          lineWidth={1}
          transparent
          opacity={0.55}
        />
      ))}

      {OCTANTS.map((oct) => {
        const active = sameOctant(isolatedOctant, oct);
        return (
          <mesh
            key={oct.join(",")}
            position={[oct[0] * OFFSET, oct[1] * OFFSET, oct[2] * OFFSET]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              // Keep the click from also reaching the reset box behind.
              e.stopPropagation();
              // Clicking the already-isolated cube clears it, so the gizmo
              // toggles instead of trapping you in an isolated view.
              setIsolatedOctant(active ? null : oct);
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHover(e.object as THREE.Mesh);
            }}
            onPointerOut={() => setHover(null)}
          >
            <boxGeometry args={[CUBE, CUBE, CUBE]} />
            <meshStandardMaterial
              color={active ? ACTIVE_COLOR : IDLE_COLOR}
              emissive={active ? ACTIVE_COLOR : HOVER_COLOR}
              emissiveIntensity={active ? 0.35 : 0}
              roughness={0.6}
              transparent
              opacity={active ? 1 : 0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// OctantGizmo is the Isolate page's control: a small 3D cube-of-cubes that
// tracks the main view's rotation, so the octant you click is the one in
// that spatial position on screen. Clicking a cube isolates that octant;
// clicking inside the surrounding outline but not on a cube reverts to the
// full grid.
export function OctantGizmo() {
  return (
    <div className="w-full aspect-square max-w-[180px] mx-auto">
      <Canvas camera={{ position: [0, 0, 4.2], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={1.1} />
        <pointLight position={[3, 4, 5]} intensity={40} />
        <GizmoScene />
      </Canvas>
    </div>
  );
}
