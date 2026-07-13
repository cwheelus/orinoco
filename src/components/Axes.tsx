import { Text, Billboard } from "@react-three/drei";

// Axes draws the three axis name labels (X/Y/Z) floating in 3D space,
// plus a small marker sphere at the origin (0,0,0).
// IN PLAIN TERMS: this is what tells the viewer which direction in the
// 3D scene corresponds to which data column (entropy, conv, WHT-score).
export function Axes() {
  // Shared text styling used by all three axis labels below
  const labelProps = {
    fontSize: 0.5,
    color: "white",
  };

  return (
    <group>
      {/* X Axis Label */}
      {/* Billboard makes the text always face the camera, so it stays
          readable no matter which angle the user is viewing from. */}
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
      {/* A small semi-transparent yellow sphere marking the (0,0,0) point,
          which is where the camera's pivot starts by default. */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="yellow" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}
