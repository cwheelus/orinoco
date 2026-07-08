import { Text, Billboard } from "@react-three/drei";

export function Axes() {
  const labelProps = {
    fontSize: 0.5,
    color: "white",
  };

  return (
    <group>
      {/* X Axis Label */}
      <Billboard position={[6, 0, 0]}>
        <Text {...labelProps}>in-entropy (X)</Text>
      </Billboard>

      {/* Y Axis Label */}
      <Billboard position={[0, 6, 0]}>
        <Text {...labelProps}>in-conv (Y)</Text>
      </Billboard>

      {/* Z Axis Label */}
      <Billboard position={[0, 0, 6]}>
        <Text {...labelProps}>WHT-score (Z)</Text>
      </Billboard>

      {/* Origin Marker */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="yellow" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}
