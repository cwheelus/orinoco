import { useStore } from "../store/useStore";
import data from "../data.json";

// Maps each data point's classification to a display color.
// IN PLAIN TERMS: every data point is colored based on what "type" it is —
// this table is what decides which color goes with which label.
const classColors: Record<string, string> = {
  unknown: "#FFFFFF", // White
  attack: "#CC0000", // Red
  normal: "#00CC00", // Green
};

// PointCloud draws every data point in the dataset as a small colored sphere
// in 3D space, and wires up mouse interaction (hover + click) for each one.
export function PointCloud() {
  // Function from the shared store used to update which point is being hovered
  const setHoveredPoint = useStore((state) => state.setHoveredPoint);
  // Function from the shared store used to update the camera's pivot point
  const setPivot = useStore((state) => state.setPivot);

  return (
    <>
      {/* Loop over every point in the dataset and render one sphere per point */}
      {data.map((point) => (
        <mesh
          key={point.uid}
          position={[point.x, point.y, point.z]}
          // When the mouse enters this point, tell the shared store which
          // point is being hovered so the HUD info panel can display it.
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredPoint(point);
          }}
          // When the mouse leaves, clear the hovered point so the HUD panel
          // goes back to its idle/placeholder state.
          onPointerOut={() => setHoveredPoint(null)}
          // Clicking a point moves the camera's orbit center (pivot) to that
          // point's location, so the user can rotate/zoom around it.
          onClick={() => setPivot([point.x, point.y, point.z])}
        >
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color={classColors[point.className] || "white"}
          />
        </mesh>
      ))}
    </>
  );
}
