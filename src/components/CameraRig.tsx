import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import * as THREE from "three";

const MOVE_SPEED = 15;
const ROTATION_SPEED = 1.5;

// Keep keys outside to avoid React re-render resets
const heldKeys: Record<string, boolean> = {
  w: false,
  a: false,
  s: false,
  d: false,
};

export function CameraRig() {
  const { camera } = useThree();
  const pivot = useStore((state) => state.pivot);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      heldKeys[e.key.toLowerCase()] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      heldKeys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, []);

  useFrame((_, delta) => {
    const pivotVector = new THREE.Vector3(...pivot);

    // 1. ZOOM logic (W/S)
    const direction = new THREE.Vector3()
      .subVectors(pivotVector, camera.position)
      .normalize();
    if (heldKeys.w)
      camera.position.addScaledVector(direction, MOVE_SPEED * delta);
    if (heldKeys.s)
      camera.position.addScaledVector(direction, -MOVE_SPEED * delta);

    // 2. ORBIT logic (A/D)
    // We move the camera position around the pivot point
    if (heldKeys.a || heldKeys.d) {
      const relativePos = new THREE.Vector3().subVectors(
        camera.position,
        pivotVector,
      );
      const angle = ROTATION_SPEED * delta * (heldKeys.a ? 1 : -1);

      // Rotate around the Y axis
      relativePos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);

      // Set new position
      camera.position.copy(pivotVector).add(relativePos);
    }

    // 3. Always look at the pivot
    camera.lookAt(pivotVector);
  });

  return null;
}
