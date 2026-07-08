import { useStore } from "../store/useStore";
import data from "../data.json";

const classColors: Record<string, string> = {
  unknown: "#FFFFFF", // White
  attack: "#CC0000", // Red
  normal: "#00CC00", // Green
};

export function PointCloud() {
  const setHoveredPoint = useStore((state) => state.setHoveredPoint);
  const setPivot = useStore((state) => state.setPivot);

  return (
    <>
      {data.map((point) => (
        <mesh
          key={point.uid}
          position={[point.x, point.y, point.z]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredPoint(point);
          }}
          onPointerOut={() => setHoveredPoint(null)}
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
