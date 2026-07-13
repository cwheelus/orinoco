import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import * as THREE from "three";

// How fast the camera moves toward/away from the pivot when zooming (W/S)
const MOVE_SPEED = 15;
// How fast the camera orbits around the pivot when rotating (A/D)
const ROTATION_SPEED = 1.5;

// Keep keys outside to avoid React re-render resets
// IN PLAIN TERMS: this object just tracks which movement keys are currently
// being held down. It's kept outside the component so React doesn't reset
// it every time the component re-renders.
const heldKeys: Record<string, boolean> = {
  w: false,
  a: false,
  s: false,
  d: false,
};

// CameraRig listens for WASD keyboard input and moves the camera every
// frame accordingly. It has no visual output of its own (returns null) —
// its only job is to update the camera's position/orientation over time.
export function CameraRig() {
  const { camera } = useThree();
  // The point in 3D space the camera should orbit around and look at
  const pivot = useStore((state) => state.pivot);

  // Set up keyboard listeners once, when this component first mounts.
  // These just flip heldKeys[...] to true/false as keys go down/up.
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      heldKeys[e.key.toLowerCase()] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      heldKeys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    // Cleanup: remove the listeners if this component is ever removed,
    // so we don't leak event handlers.
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, []);

  // useFrame runs this logic once every rendered frame (many times per
  // second), which is what makes holding a key feel like smooth movement
  // rather than a single instant jump.
  useFrame((_, delta) => {
    const pivotVector = new THREE.Vector3(...pivot);

    // 1. ZOOM logic (W/S)
    // IN PLAIN TERMS: figures out the straight-line direction from the
    // camera to the pivot point, then moves the camera a little bit along
    // that line each frame — forward for W, backward for S.
    const direction = new THREE.Vector3()
      .subVectors(pivotVector, camera.position)
      .normalize();
    if (heldKeys.w)
      camera.position.addScaledVector(direction, MOVE_SPEED * delta);
    if (heldKeys.s)
      camera.position.addScaledVector(direction, -MOVE_SPEED * delta);

    // 2. ORBIT logic (A/D)
    // We move the camera position around the pivot point
    // IN PLAIN TERMS: instead of moving in a straight line, this rotates
    // the camera's position around the pivot point, like walking in a
    // circle around a fixed spot while always facing the center.
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
    // Regardless of how the camera just moved, always point it back at
    // the pivot so the current focus point stays centered on screen.
    camera.lookAt(pivotVector);
  });

  return null;
}
