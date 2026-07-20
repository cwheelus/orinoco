import { useStore } from "../store/useStore";
import { classColors, DEFAULT_CLASS_COLOR } from "../lib/classColors";

// Sphere radius at MIN_SCALE === 1 (roughly: a small, tightly-clustered
// dataset that needed no shrinking to fit the box on any axis).
const BASE_RADIUS = 0.1;
// Radius is never allowed outside this range, regardless of MIN_SCALE.
const MIN_RADIUS = 0.04;
const MAX_RADIUS = 0.15;

// PointCloud renders every point in the dataset as a small sphere
// positioned in 3D space, and wires up pointer (mouse) interaction for
// each one: hover shows details in the HUD, click moves the camera's
// pivot to that point's location.
export function PointCloud() {
  // The active dataset — starts as the bundled data.json (see
  // useStore.ts's default), but is fully replaced whenever a CSV is
  // loaded via the Toolbar's setDataPoints call. Reading this from the
  // store (rather than a static top-level import) is what makes CSV
  // loading actually take effect without a page reload: this component
  // re-renders automatically whenever dataPoints changes.
  const dataPoints = useStore((state) => state.dataPoints);
  // toRenderSpace and MIN_SCALE both come from the store's gridSpace
  // now, instead of a static gridSpace.ts import. gridSpace is
  // recomputed by setDataPoints every time the active dataset changes
  // (see useStore.ts), so a newly loaded CSV gets its own correctly
  // scaled positions and point size — not the previous dataset's frozen
  // values.
  const { toRenderSpace, MIN_SCALE } = useStore((state) => state.gridSpace);
  // Setter functions pulled from the shared Zustand store. Calling these
  // updates global state that other components (App.tsx's HUD, and
  // CameraRig.tsx's orbit target) read independently — this is how a
  // mouse event inside the 3D canvas can affect the 2D HUD outside it,
  // without PointCloud needing any direct reference to those components.
  const setHoveredPoint = useStore((state) => state.setHoveredPoint);
  const setPivot = useStore((state) => state.setPivot);

  // Scaling the sphere radius by MIN_SCALE — the most-compressed of the
  // three (independent, per-axis) position scale factors from the
  // current dataset's gridSpace — keeps balls proportionate to how
  // tightly packed the data actually is. Computed per-render (not as a
  // module-level constant) since MIN_SCALE now varies by dataset.
  const pointRadius = Math.min(
    MAX_RADIUS,
    Math.max(MIN_RADIUS, BASE_RADIUS * MIN_SCALE),
  );

  return (
    <>
      {/* .map() over the dataset produces one <mesh> per point. Each
          mesh needs a unique `key` (React's requirement for rendering
          lists) — point.uid is used since it's guaranteed unique per
          row in the dataset, unlike array index which could shift if
          the dataset is ever re-sorted or filtered. */}
      {dataPoints.map((point) => {
        // toRenderSpace centers and scales the raw data point into the
        // fixed -2..2 box — point.x/y/z themselves are never modified,
        // so the HUD's point inspector below still shows the true,
        // un-normalized values for analysis.
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
                pointRadius (derived from MIN_SCALE above), not a fixed
                value, so ball size adapts to how compressed the CURRENT
                dataset is. */}
            <sphereGeometry args={[pointRadius, 16, 16]} />
            <meshStandardMaterial
              color={classColors[point.className] || DEFAULT_CLASS_COLOR}
            />
          </mesh>
        );
      })}
    </>
  );
}
