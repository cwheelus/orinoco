import { useStore } from "../store/useStore";
import { toRenderSpace, MIN_SCALE } from "../lib/gridSpace";
import { classColors, DEFAULT_CLASS_COLOR } from "../lib/classColors";
import data from "../data.json";

// Sphere radius at MIN_SCALE === 1 (roughly: a small, tightly-clustered
// dataset that needed no shrinking to fit the box on any axis).
const BASE_RADIUS = 0.1;
// Radius is never allowed outside this range, regardless of MIN_SCALE.
const MIN_RADIUS = 0.04;
const MAX_RADIUS = 0.15;

// Scaling the sphere radius by MIN_SCALE — the most-compressed of the
// three (now independent, per-axis) position scale factors from
// lib/gridSpace.ts — keeps balls proportionate to how tightly packed the
// data actually is: a widely spread or densely clustered dataset gets
// compressed harder to fit the fixed box on at least one axis, so points
// sit closer together in render space along that axis — shrinking the
// balls by that same (worst-case) factor keeps them from overlapping as
// badly. Clamped at both ends: without a floor, a very spread-out dataset
// would shrink points to invisible flecks; without a ceiling, a
// near-degenerate (almost zero-spread) dataset could inflate the scale
// enough to render balls bigger than the box itself.
const POINT_RADIUS = Math.min(
  MAX_RADIUS,
  Math.max(MIN_RADIUS, BASE_RADIUS * MIN_SCALE),
);

// PointCloud renders every point in the dataset as a small sphere
// positioned in 3D space, and wires up pointer (mouse) interaction for
// each one: hover shows details in the HUD, click moves the camera's
// pivot to that point's location.
export function PointCloud() {
  // Setter functions pulled from the shared Zustand store. Calling these
  // updates global state that other components (App.tsx's HUD, and
  // CameraRig.tsx's orbit target) read independently — this is how a
  // mouse event inside the 3D canvas can affect the 2D HUD outside it,
  // without PointCloud needing any direct reference to those components.
  const setHoveredPoint = useStore((state) => state.setHoveredPoint);
  const setPivot = useStore((state) => state.setPivot);

  return (
    <>
      {/* .map() over the dataset produces one <mesh> per point. Each
          mesh needs a unique `key` (React's requirement for rendering
          lists) — point.uid is used since it's guaranteed unique per
          row in the dataset, unlike array index which could shift if
          the dataset is ever re-sorted or filtered. */}
      {data.map((point) => {
        // toRenderSpace centers and scales the raw data point into the
        // fixed -2..2 box (see lib/gridSpace.ts) — point.x/y/z themselves
        // are never modified, so the HUD's point inspector below still
        // shows the true, un-normalized values for analysis.
        const renderPosition = toRenderSpace(point);
        return (
          <mesh
            key={point.uid}
            position={renderPosition}
            // Fires when the mouse cursor enters this mesh's bounds.
            // stopPropagation() prevents the event from also bubbling up
            // to any parent/overlapping 3D objects behind this point.
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredPoint(point);
            }}
            // Fires when the mouse cursor leaves this mesh's bounds,
            // clearing the hover state so the HUD panel goes back to its
            // idle state.
            onPointerOut={() => setHoveredPoint(null)}
            // Fires on click. Updates the shared pivot to this point's
            // rendered (centered/scaled) position, not its raw data
            // coordinates — CameraRig.tsx and OrbitControls (in App.tsx)
            // both orbit/look at the pivot, so it must match where the
            // sphere is actually drawn.
            onClick={() => setPivot(renderPosition)}
          >
            {/* args: [radius, widthSegments, heightSegments] — 16 segments
                in each direction gives a reasonably smooth sphere without
                excessive geometry for a point this small. Radius is
                POINT_RADIUS (derived from SCALE above), not a fixed value,
                so ball size adapts to how compressed this dataset is. */}
            <sphereGeometry args={[POINT_RADIUS, 16, 16]} />
            <meshStandardMaterial
              color={classColors[point.className] || DEFAULT_CLASS_COLOR}
            />
          </mesh>
        );
      })}
    </>
  );
}
