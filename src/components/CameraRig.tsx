import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import * as THREE from "three";

// How fast the camera moves toward/away from the pivot when zooming (W/S)
const MOVE_SPEED = 15;
// How fast the camera orbits around the pivot when rotating (A/D)
const ROTATION_SPEED = 1.5;
// How fast the arrow/space/shift keys traverse the pivot through the
// scene, in render-space units per second (the box is 4 units wide).
const PIVOT_SPEED = 1.5;

// Keys whose browser default behavior (scrolling the page) must be
// suppressed while the visualizer is driving them.
const PREVENT_DEFAULT_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  " ",
]);

// Tracks which movement keys are currently held down. This is a plain
// object living outside the component (not useState), because updating
// it doesn't need to trigger a React re-render — useFrame already reads
// it fresh every frame regardless. Using useState here would cause
// unnecessary re-renders on every keypress, and React's render cycle
// isn't fast enough for smooth per-frame movement anyway.
const heldKeys: Record<string, boolean> = {
  w: false,
  a: false,
  s: false,
  d: false,
  arrowup: false,
  arrowdown: false,
  arrowleft: false,
  arrowright: false,
  " ": false, // space
  shift: false,
};

// CameraRig listens for WASD keyboard input and moves the camera every
// frame accordingly. It renders no visible output itself (returns null)
// — its only job is to mutate the camera's position/orientation over
// time as a side effect.
export function CameraRig() {
  // useThree() gives access to the R3F scene's shared objects — here we
  // only need the active camera, which we'll mutate directly below.
  const { camera } = useThree();
  // The point in 3D space the camera should orbit around and look at.
  // Read from the shared Zustand store so it stays in sync with
  // PointCloud.tsx, which is what actually updates this value on click.
  const pivot = useStore((state) => state.pivot);
  // Setter for the pivot — the arrow/space/shift keys below move the
  // pivot itself (unlike WASD, which moves the camera around it).
  const setPivot = useStore((state) => state.setPivot);

  // The pivot position as of the previous frame. Comparing against it
  // each frame is how we detect that the pivot moved (e.g. the user
  // clicked a data point) so the camera can be translated by the same
  // offset — keeping its rotation fixed instead of snapping to face the
  // new pivot from its old position.
  const prevPivot = useRef(new THREE.Vector3(...pivot));

  // Registers raw browser keyboard listeners once, when this component
  // first mounts. We use native addEventListener here instead of React
  // event props because keyboard input needs to work globally (anywhere
  // on the page), not just when a specific element is focused.
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Arrows and space normally scroll the page — swallow that so
      // pivot traversal doesn't also drag the viewport around.
      if (PREVENT_DEFAULT_KEYS.has(key)) e.preventDefault();
      heldKeys[key] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      heldKeys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    // Cleanup function: React calls this if the component ever unmounts,
    // removing the listeners so they don't keep firing (and leaking
    // memory) after this component no longer exists.
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, []); // empty dependency array: run once on mount, never again

  // useFrame (from R3F) runs this callback once per rendered frame —
  // typically 60 times per second. `delta` is the time in seconds since
  // the last frame, used below to make movement speed independent of
  // frame rate (so it moves at the same real-world speed whether the
  // browser renders at 30fps or 144fps).
  useFrame((_, delta) => {
    // Converts the plain [x, y, z] array from the store into a
    // THREE.Vector3, which supports the vector math methods used below.
    const pivotVector = new THREE.Vector3(...pivot);

    // 0a. PIVOT FOLLOW (external changes, e.g. clicking a data point)
    // If the pivot moved since last frame, translate the camera by that
    // same offset. A pure translation preserves the camera's rotation —
    // the new pivot lands at the exact screen position the old one held,
    // rather than the camera whipping around to face it. (This is what
    // satisfies "changing the pivot must not change camera rotation".)
    if (!prevPivot.current.equals(pivotVector)) {
      camera.position.add(
        new THREE.Vector3().subVectors(pivotVector, prevPivot.current),
      );
      prevPivot.current.copy(pivotVector);
    }

    // 0b. PIVOT TRAVERSAL (arrows / space / shift)
    // Each axis pairs two keys into a -1/0/+1 direction:
    //   Left/Right  -> x (orig-bytes axis)
    //   Space/Shift -> y (invel-pps axis: space rises, shift descends)
    //   Up/Down     -> z (invel-bpp axis)
    // The camera is moved by the same offset in the same frame (same
    // rotation-preserving translation as 0a), and prevPivot is updated
    // immediately so 0a doesn't re-apply this movement next frame.
    const move = new THREE.Vector3(
      (heldKeys.arrowright ? 1 : 0) - (heldKeys.arrowleft ? 1 : 0),
      (heldKeys[" "] ? 1 : 0) - (heldKeys.shift ? 1 : 0),
      (heldKeys.arrowup ? 1 : 0) - (heldKeys.arrowdown ? 1 : 0),
    );
    if (move.lengthSq() > 0) {
      move.multiplyScalar(PIVOT_SPEED * delta);
      pivotVector.add(move);
      camera.position.add(move);
      prevPivot.current.copy(pivotVector);
      setPivot([pivotVector.x, pivotVector.y, pivotVector.z]);
    }

    // 1. ZOOM logic (W/S)
    // Computes the straight-line direction FROM the camera TO the pivot,
    // as a unit vector (length 1, via .normalize()). Multiplying this
    // direction by MOVE_SPEED * delta and adding it to the camera's
    // position moves the camera along that line — toward the pivot for
    // W, away from it for S (negative scale).
    const direction = new THREE.Vector3()
      .subVectors(pivotVector, camera.position)
      .normalize();
    if (heldKeys.w)
      camera.position.addScaledVector(direction, MOVE_SPEED * delta);
    if (heldKeys.s)
      camera.position.addScaledVector(direction, -MOVE_SPEED * delta);

    // 2. ORBIT logic (A/D)
    // Rather than moving in a straight line, this rotates the camera's
    // position around the pivot point on the Y axis (i.e. horizontally,
    // like walking in a circle around a fixed spot).
    if (heldKeys.a || heldKeys.d) {
      // relativePos: the camera's position expressed relative to the
      // pivot (as if the pivot were the origin). Rotating this vector
      // and adding it back to the pivot is the standard way to orbit
      // a point around another point in 3D.
      const relativePos = new THREE.Vector3().subVectors(
        camera.position,
        pivotVector,
      );
      const angle = ROTATION_SPEED * delta * (heldKeys.a ? 1 : -1);

      // applyAxisAngle rotates a vector around a given axis by a given
      // angle (in radians). (0,1,0) is the Y axis (straight up), so this
      // spins relativePos horizontally around the pivot.
      relativePos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);

      // Add the rotated relative position back onto the pivot to get
      // the camera's new absolute position in the scene.
      camera.position.copy(pivotVector).add(relativePos);
    }

    // 3. Always look at the pivot
    // Runs every frame regardless of which keys are held, so the camera
    // stays pointed at the pivot even as its position changes above.
    // NOTE: this currently runs alongside OrbitControls (in App.tsx),
    // which also repositions/reorients the camera on mouse drag. Since
    // both systems mutate the camera independently within the same
    // frame loop, they can drift out of sync with each other — see
    // issue #5/#7 for the planned fix.
    camera.lookAt(pivotVector);
  });

  return null;
}
