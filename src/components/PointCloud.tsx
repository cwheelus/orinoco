import { useStore } from "../store/useStore";
import data from "../data.json";

// Maps each data point's classification to a display color. Currently
// hardcoded to match the three categories from the original spec
// (attack/normal/unknown) — see issue #2 for the plan to derive this
// dynamically from an uploaded color-mapping file instead.
const classColors: Record<string, string> = {
  unknown: "#FFFFFF", // White
  attack: "#CC0000", // Red
  normal: "#00CC00", // Green
};

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
      {data.map((point) => (
        <mesh
          key={point.uid}
          position={[point.x, point.y, point.z]}
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
          // coordinates — CameraRig.tsx and OrbitControls (in App.tsx)
          // both read this value to know what to orbit/look at.
          onClick={() => setPivot([point.x, point.y, point.z])}
        >
          {/* args: [radius, widthSegments, heightSegments] — 16 segments
              in each direction gives a reasonably smooth sphere without
              excessive geometry for a point this small. */}
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color={classColors[point.className] || "white"}
          />
        </mesh>
      ))}
    </>
  );
}
