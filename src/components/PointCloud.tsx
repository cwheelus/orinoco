import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import { classColors, DEFAULT_CLASS_COLOR } from "../lib/classColors";

// Auto point-size model. Positions are normalized into the fixed -2..2
// box, so on-screen crowding is driven by how MANY points share that
// fixed volume, not by the data's raw scale — i.e. by point COUNT. So
// the automatic radius shrinks with count (~1/sqrt(N)): a sparse dataset
// gets big, easy-to-see points; a dense 10k/100k cloud gets small ones
// so individual points stay distinguishable instead of merging into an
// unreadable blob. (The previous model scaled by the data's axis
// compression, which for real datasets was always ~0 and so pinned every
// dataset to the floor regardless of count — the root cause of dense
// clouds being illegible.)
const REFERENCE_COUNT = 200; // point count at which the auto radius === BASE_RADIUS
const BASE_RADIUS = 0.045; // auto radius at REFERENCE_COUNT points
const AUTO_MIN_RADIUS = 0.0015; // floor for the AUTO size (before the user multiplier)
const AUTO_MAX_RADIUS = 0.12; // ceiling for the AUTO size
// Hard clamp on the FINAL radius after the user's slider multiplier, so
// neither an extreme dataset nor an extreme slider value can produce an
// invisible speck or a box-filling ball.
const HARD_MIN_RADIUS = 0.0008;
const HARD_MAX_RADIUS = 0.3;
// Segment count for the shared sphere geometry. Kept low (8×8 ≈ 96
// triangles) because at scatter-plot scale each point is tiny — often
// sub-pixel at 100k — so extra tessellation is invisible but multiplies
// vertex work by the instance count.
const SPHERE_SEGMENTS = 8;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Scratch object reused across the whole matrix-fill loop, so building
// 100k instance matrices allocates nothing per point.
const scratchObject = new THREE.Object3D();
const scratchColor = new THREE.Color();

// PointCloud renders the entire dataset as a SINGLE instanced mesh —
// one geometry, one material, one draw call — scaling to 100k+ points.
// Point SIZE lives in the shared sphere geometry's radius (not in the
// per-instance transforms), so changing size — e.g. dragging the Data
// page's size slider — is an O(1) geometry swap rather than an O(n)
// rewrite-and-reupload of every instance matrix. Instance matrices carry
// position only.
export function PointCloud() {
  const dataPoints = useStore((state) => state.dataPoints);
  const { toRenderSpace } = useStore((state) => state.gridSpace);
  const setHoveredPoint = useStore((state) => state.setHoveredPoint);
  const setPivot = useStore((state) => state.setPivot);
  // User size multiplier from the Data page slider (1 = automatic).
  const pointSizeScale = useStore((state) => state.pointSizeScale);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Last instance the pointer reported as hovered, so onPointerMove only
  // writes to the store when the pointer crosses onto a different point.
  const hoveredIdRef = useRef<number | null>(null);

  // Automatic radius from point count, then the user multiplier on top.
  const pointRadius = useMemo(() => {
    const n = Math.max(1, dataPoints.length);
    const autoRadius = clamp(
      BASE_RADIUS * Math.sqrt(REFERENCE_COUNT / n),
      AUTO_MIN_RADIUS,
      AUTO_MAX_RADIUS,
    );
    return clamp(autoRadius * pointSizeScale, HARD_MIN_RADIUS, HARD_MAX_RADIUS);
  }, [dataPoints.length, pointSizeScale]);

  // Render-space position of every point, computed ONCE per dataset
  // change (not per render). Reused by the click handler to pivot to a
  // clicked point's rendered position without recomputing.
  const positions = useMemo(() => {
    const out = new Array<[number, number, number]>(dataPoints.length);
    for (let i = 0; i < dataPoints.length; i++) {
      out[i] = toRenderSpace(dataPoints[i]);
    }
    return out;
  }, [dataPoints, toRenderSpace]);

  // Fill the instance matrices (position only) and colors. Note this does
  // NOT depend on pointRadius — size is applied via the geometry below —
  // so dragging the size slider never re-runs this O(n) loop or re-uploads
  // the instance buffers.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < dataPoints.length; i++) {
      const [x, y, z] = positions[i];
      scratchObject.position.set(x, y, z);
      scratchObject.updateMatrix();
      mesh.setMatrixAt(i, scratchObject.matrix);
      scratchColor.set(
        classColors[dataPoints[i].className] || DEFAULT_CLASS_COLOR,
      );
      mesh.setColorAt(i, scratchColor);
    }
    mesh.count = dataPoints.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dataPoints, positions]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    // instanceId can be 0 (a valid index), so compare against undefined.
    if (e.instanceId === undefined || e.instanceId === hoveredIdRef.current) {
      return;
    }
    hoveredIdRef.current = e.instanceId;
    setHoveredPoint(dataPoints[e.instanceId]);
  };

  const handlePointerOut = () => {
    hoveredIdRef.current = null;
    setHoveredPoint(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    setPivot(positions[e.instanceId]);
  };

  return (
    // key forces a fresh InstancedMesh (and correctly-sized buffers) when
    // the point count changes, e.g. loading a CSV with a different row
    // count. args' third element sizes the instance buffers.
    <instancedMesh
      key={dataPoints.length}
      ref={meshRef}
      args={[undefined, undefined, dataPoints.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* One sphere shared by every instance. Its radius IS the point
          size — changing it (via the slider) rebuilds just this one tiny
          geometry, leaving the instance matrices/colors untouched. */}
      <sphereGeometry args={[pointRadius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
      {/* Per-instance color comes from setColorAt (instanceColor); three
          applies it automatically for an InstancedMesh. Lighting still
          shades each instance. */}
      <meshStandardMaterial />
    </instancedMesh>
  );
}
