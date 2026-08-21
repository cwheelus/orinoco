import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import type {
  DataPoint,
  NumericFilter,
  NumericFilters,
} from "../store/useStore";
import { getClassColor } from "../lib/classColors";
import { inOctant, type OctantSign } from "../lib/gridSpace";
import { config } from "../lib/config";

// Auto point-size model, tunable via config.json's `points` section.
// Positions are normalized into the fixed render box, so on-screen
// crowding is driven by how MANY points share that fixed volume — i.e.
// by point COUNT. So the automatic radius shrinks with count
// (~1/sqrt(N)): a sparse dataset gets big, easy-to-see points; a dense
// 10k/100k cloud gets small ones so points stay distinguishable
// instead of merging into a blob.
const {
  referenceCount: REFERENCE_COUNT, // point count at which the auto radius === BASE_RADIUS
  baseRadius: BASE_RADIUS, // auto radius at REFERENCE_COUNT points
  autoMinRadius: AUTO_MIN_RADIUS, // floor for the AUTO size (before the user multiplier)
  autoMaxRadius: AUTO_MAX_RADIUS, // ceiling for the AUTO size
  // Hard clamp on the FINAL radius after the user's slider multiplier.
  hardMinRadius: HARD_MIN_RADIUS,
  hardMaxRadius: HARD_MAX_RADIUS,
  sphereSegments: SPHERE_SEGMENTS,
} = config.points;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Applies one numeric filter to a single value. An "off" op, or a value
// box that isn't a finite number (empty, "-", mid-typing), means "no
// filter" — the point passes on that axis.
export function passesNumeric(value: number, f: NumericFilter): boolean {
  if (f.op === "off") return true;

  // Inclusive range. Either bound left blank/invalid is simply ignored,
  // so a "between" with only one box filled behaves as a single-sided
  // bound (>= min, or <= max) rather than filtering nothing.
  if (f.op === "between") {
    const lo = parseFloat(f.value);
    const hi = parseFloat(f.value2);

    // An inverted range (min > max) is a user-input error, not a
    // legitimate "match nothing" filter — the UI's min/max boxes have
    // no guard against an analyst typing them backwards. Applying both
    // bounds literally in that case would silently exclude every
    // point with zero indication why (found during #59 testing).
    // Swap the effective bounds so the filter behaves the way an
    // analyst almost certainly intended, rather than failing silently.
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) {
      if (value < hi) return false;
      if (value > lo) return false;
      return true;
    }

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

// The whole visibility rule for one point, in one place: a point is
// drawn only if its class isn't hidden, it satisfies every active axis
// filter, and it falls inside the isolated octant (if any).
//
// The three filters are independent and combine as AND — hiding a class
// never reveals a point some numeric filter excluded, and clearing a
// numeric filter never reveals a hidden class's points. Extracted from
// the render loop below (like passesNumeric above) so that rule is
// testable without mounting a WebGL scene — see
// lib/__tests__/isVisible.test.ts (#64 Tier 1).
//
// `hidden` is a Set rather than the store's array because this runs
// once per point per filter change: on a 100k-row dataset an
// Array.includes scan would make class hiding O(points × classes).
export function isVisible(
  p: DataPoint,
  hidden: ReadonlySet<string>,
  filters: NumericFilters,
  isolatedOctant: OctantSign | null,
): boolean {
  if (hidden.has(p.className)) return false;

  if (!passesNumeric(p.x, filters.x)) return false;
  if (!passesNumeric(p.y, filters.y)) return false;
  if (!passesNumeric(p.z, filters.z)) return false;

  // Octant isolation hides everything outside the selected corner.
  return inOctant(p, isolatedOctant);
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
  const pointOpacity = useStore((state) => state.pointOpacity);
  const hiddenClasses = useStore((state) => state.hiddenClasses);
  const numericFilters = useStore((state) => state.numericFilters);
  const isolatedOctant = useStore((state) => state.isolatedOctant);

  // Highest-precedence manual class color overrides.
  // Analyst-defined color overrides. Passed to getClassColor() so manual
  // color changes propagate to the rendered point cloud.
  const classColorOverrides = useStore((state) => state.classColorOverrides);

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

      if (!isVisible(p, hidden, numericFilters, isolatedOctant)) continue;

      points.push(p);
      pts.push(positions[i]);
    }

    return { points, positions: pts };
  }, [dataPoints, positions, hiddenClasses, numericFilters, isolatedOctant]);

  // Fill instance matrices (position only) and colors for the visible
  // subset, then cap mesh.count so only those instances draw/raycast.
  //
  // COLOR RESOLUTION:
  // Colors come from getClassColor() rather than a static lookup table.
  //
  //   1. Unknown classes receive deterministic generated colors.
  //
  //   2. Manual overrides are resolved centrally by getClassColor().
  //      Updating classColorOverrides immediately updates the
  //      rendered points.
  //
  //   3. getClassColor() always returns "#rrggbb" hex, which THREE.Color
  //      accepts directly.
  //
  // If you add another color source (for example, intensity or heat-map
  // coloring), keep PointCloud a consumer of the centralized resolver.
  // Color policy belongs in lib/classColors.ts.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { points, positions: vpos } = visible;

    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = vpos[i];

      scratchObject.position.set(x, y, z);
      scratchObject.updateMatrix();
      mesh.setMatrixAt(i, scratchObject.matrix);

      // Resolve this instance's display color through the centralized resolver.
      scratchColor.set(getClassColor(points[i].className, classColorOverrides));

      mesh.setColorAt(i, scratchColor);
    }

    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    // Bounding volume depends on the current visible instance count.
    mesh.computeBoundingSphere();
  }, [visible, classColorOverrides]);

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
      {/* Alpha comes from the Data page's opacity slider. Below 1,
          overlapping/coincident points remain visually distinguishable
          instead of merging into one solid shape — see #67 — and
          depthWrite is turned OFF, because a transparent instance that
          writes depth lets a nearer instance incorrectly hide a farther
          one drawn after it. This does NOT make blending strictly
          back-to-front: instances still blend in draw order, which is
          acceptable for uniform, small spheres. Worth revisiting if
          this material is ever used for meshes of mixed size.

          At exactly 1 the material goes back to fully opaque with
          depth writing ON, so the analyst gets correct, cheap depth
          sorting rather than order-dependent blending of alpha-1
          fragments. */}
      <meshStandardMaterial
        transparent={pointOpacity < 1}
        opacity={pointOpacity}
        depthWrite={pointOpacity >= 1}
      />
    </instancedMesh>
  );
}
