import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import type { DataPoint, NumericFilter } from "../store/useStore";
import { getClassColor } from "../lib/classColors";
import { inOctant } from "../lib/gridSpace";

// Auto point-size model. Positions are normalized into the fixed -2..2
// box, so on-screen crowding is driven by how MANY points share that
// fixed volume — i.e. by point COUNT. So the automatic radius shrinks
// with count (~1/sqrt(N)): a sparse dataset gets big, easy-to-see points;
// a dense 10k/100k cloud gets small ones so points stay distinguishable
// instead of merging into a blob.
const REFERENCE_COUNT = 200; // point count at which the auto radius === BASE_RADIUS
const BASE_RADIUS = 0.045; // auto radius at REFERENCE_COUNT points
const AUTO_MIN_RADIUS = 0.0015; // floor for the AUTO size (before the user multiplier)
const AUTO_MAX_RADIUS = 0.12; // ceiling for the AUTO size
// Hard clamp on the FINAL radius after the user's slider multiplier.
const HARD_MIN_RADIUS = 0.0008;
const HARD_MAX_RADIUS = 0.3;
const SPHERE_SEGMENTS = 8;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Applies one numeric filter to a single value. An "off" op, or a value
// box that isn't a finite number (empty, "-", mid-typing), means "no
// filter" — the point passes on that axis.
function passesNumeric(value: number, f: NumericFilter): boolean {
  if (f.op === "off") return true;
  // Inclusive range. Either bound left blank/invalid is simply ignored,
  // so a "between" with only one box filled behaves as a single-sided
  // bound (>= min, or <= max) rather than filtering nothing.
  if (f.op === "between") {
    const lo = parseFloat(f.value);
    const hi = parseFloat(f.value2);
    if (Number.isFinite(lo) && value < lo) return false;
    if (Number.isFinite(hi) && value > hi) return false;
    return true;
  }
  const threshold = parseFloat(f.value);
  if (!Number.isFinite(threshold)) return true;
  switch (f.op) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      return true;
  }
}

// Scratch objects reused across the whole matrix-fill loop, so building
// 100k instance matrices allocates nothing per point.
const scratchObject = new THREE.Object3D();
const scratchColor = new THREE.Color();

// PointCloud renders the dataset as a SINGLE instanced mesh — one
// geometry, one material, one draw call — scaling to 100k+ points.
// Filtering (hidden classes + per-axis numeric filters) is applied by
// packing only the PASSING points into the front of the instance buffers
// and setting mesh.count to that many, so hidden points are neither drawn
// nor raycast, and no remount/reallocation happens when filters change.
export function PointCloud() {
  const dataPoints = useStore((state) => state.dataPoints);
  const { toRenderSpace } = useStore((state) => state.gridSpace);
  const setHoveredPoint = useStore((state) => state.setHoveredPoint);
  const setPivot = useStore((state) => state.setPivot);
  const pointSizeScale = useStore((state) => state.pointSizeScale);
  const hiddenClasses = useStore((state) => state.hiddenClasses);
  const numericFilters = useStore((state) => state.numericFilters);
  const isolatedOctant = useStore((state) => state.isolatedOctant);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredIdRef = useRef<number | null>(null);

  // Auto radius from TOTAL point count (not the filtered count, so points
  // don't resize as you filter), then the user's slider multiplier.
  const pointRadius = useMemo(() => {
    const n = Math.max(1, dataPoints.length);
    const autoRadius = clamp(
      BASE_RADIUS * Math.sqrt(REFERENCE_COUNT / n),
      AUTO_MIN_RADIUS,
      AUTO_MAX_RADIUS,
    );
    return clamp(autoRadius * pointSizeScale, HARD_MIN_RADIUS, HARD_MAX_RADIUS);
  }, [dataPoints.length, pointSizeScale]);

  // Render-space position of every point, computed once per dataset.
  const positions = useMemo(() => {
    const out = new Array<[number, number, number]>(dataPoints.length);
    for (let i = 0; i < dataPoints.length; i++) {
      out[i] = toRenderSpace(dataPoints[i]);
    }
    return out;
  }, [dataPoints, toRenderSpace]);

  // The subset of points passing all active filters, plus their
  // positions — index-aligned, so instanceId (from a raycast hit) maps
  // straight back to the right data point below. Recomputed only when the
  // data, positions, or filters change.
  const visible = useMemo(() => {
    const hidden = new Set(hiddenClasses);
    const points: DataPoint[] = [];
    const pts: [number, number, number][] = [];
    for (let i = 0; i < dataPoints.length; i++) {
      const p = dataPoints[i];
      if (hidden.has(p.className)) continue;
      if (!passesNumeric(p.x, numericFilters.x)) continue;
      if (!passesNumeric(p.y, numericFilters.y)) continue;
      if (!passesNumeric(p.z, numericFilters.z)) continue;
      // Octant isolation hides everything outside the selected corner.
      if (!inOctant(p, isolatedOctant)) continue;
      points.push(p);
      pts.push(positions[i]);
    }
    return { points, positions: pts };
  }, [dataPoints, positions, hiddenClasses, numericFilters, isolatedOctant]);

  // Fill instance matrices (position only) and colors for the visible
  // subset, then cap mesh.count so only those instances draw/raycast.
  //
  // COLOR RESOLUTION:
  // Colors come from getClassColor() (lib/classColors.ts), NOT from a
  // static map. This gives us three things the old static map couldn't:
  //
  //   1. Deterministic fallback colors for unknown classes — instead of
  //      defaulting to white when a class isn't in a hardcoded map, we
  //      hash the class name to a stable hue. Same name always gets the
  //      same color, across reloads, across datasets.
  //
  //   2. Future manual overrides — getClassColor() already accepts an
  //      overrides argument (second param). When the color-picker UI lands
  //      (Phase 4 of #43), pass store.classColorOverrides here and the
  //      instance colors will update automatically — no changes needed
  //      in this file.
  //
  //   3. Hex contract — getClassColor() ALWAYS returns "#rrggbb" hex,
  //      never HSL or named colors. THREE.Color.set() accepts hex directly,
  //      so no conversion logic lives here.
  //
  // If you're adding a new color source (e.g. per-point intensity mapping),
  // keep the hex contract — THREE.Color.set() is the consumer.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { points, positions: vpos } = visible;
    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = vpos[i];
      scratchObject.position.set(x, y, z);
      scratchObject.updateMatrix();
      mesh.setMatrixAt(i, scratchObject.matrix);
      // Resolve color through the centralized resolver. See the COLOR
      // RESOLUTION note above for why this isn't a static map lookup.
      scratchColor.set(getClassColor(points[i].className));
      mesh.setColorAt(i, scratchColor);
    }
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // computeBoundingSphere uses mesh.count, so set count first (above).
    mesh.computeBoundingSphere();
  }, [visible]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined || e.instanceId === hoveredIdRef.current) {
      return;
    }
    hoveredIdRef.current = e.instanceId;
    setHoveredPoint(visible.points[e.instanceId]);
  };

  const handlePointerOut = () => {
    hoveredIdRef.current = null;
    setHoveredPoint(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    setPivot(visible.positions[e.instanceId]);
  };

  return (
    // key sizes the instance buffers to the full dataset (the max the
    // filtered count can reach); a different point count on CSV load
    // remounts with correctly-sized buffers.
    <instancedMesh
      key={dataPoints.length}
      ref={meshRef}
      args={[undefined, undefined, dataPoints.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* One sphere shared by every instance; its radius IS the point
          size, so the size slider is an O(1) geometry swap. */}
      <sphereGeometry args={[pointRadius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
