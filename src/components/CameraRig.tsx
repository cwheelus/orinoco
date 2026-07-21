import { useEffect, useRef, type RefObject } from "react";
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

// World units panned per screen pixel, at PAN_REFERENCE_DISTANCE from the
// pivot. Scaled by actual camera-to-pivot distance on every drag so
// panning feels consistent whether zoomed in tight or pulled back.
const PAN_REFERENCE_DISTANCE = 5;
const PAN_SPEED_AT_REFERENCE = 0.003;

// Shared axis vector, reused instead of allocating (0,1,0) fresh anywhere
// it's needed (orbit rotation axis).
const WORLD_UP = new THREE.Vector3(0, 1, 0);

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
// object living outside the component (not useState/useRef) — there is
// exactly one CameraRig instance in this app, so module-level storage
// carries no real multi-instance risk, and it avoids re-render churn on
// every keypress. Only the keys listed here are ever set to true (see
// handleDown's allowlist check below) — this object doubles as that
// allowlist, so an unrelated key (e.g. CapsLock, Escape) can't get added
// as a stray property.
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

interface CameraRigProps {
  // Ref to the pivot cross marker group (rendered in App.tsx). CameraRig
  // moves it imperatively every frame so it stays in exact lockstep with
  // the camera. Binding the marker to React state instead made it lag a
  // frame or more behind: state updates commit asynchronously, after this
  // frame loop has already moved the camera imperatively.
  pivotMarkerRef: RefObject<THREE.Group | null>;
}

// CameraRig listens for WASD + arrow/space/shift keyboard input, and
// (when the "pan" tool is active) mouse-drag panning, moving the camera
// and pivot every frame accordingly. It renders no visible output itself
// (returns null) — its only job is to mutate the camera and the pivot
// marker's position/orientation over time as a side effect.
export function CameraRig({ pivotMarkerRef }: CameraRigProps) {
  // useThree() gives access to the R3F scene's shared objects — the
  // active camera (mutated directly below) and the canvas DOM element
  // (gl.domElement), which pointer-drag panning listens on directly.
  const { camera, gl } = useThree();
  // Setter for the pivot. Its identity is stable, so reading it via the
  // hook does NOT re-render this component. We deliberately do not
  // subscribe to `pivot` itself — that would re-render CameraRig on every
  // frame during traversal. The live pivot is read imperatively from the
  // store inside useFrame instead (via useStore.getState()).
  const setPivot = useStore((state) => state.setPivot);

  // The authoritative pivot position during the frame loop. Every camera
  // calculation AND the marker read from this single value, so they can
  // never disagree (which is what eliminates the marker lag). Seeded from
  // the store's current value at mount.
  const livePivot = useRef(new THREE.Vector3(...useStore.getState().pivot));
  // The store's pivot value as of the previous frame. Used to detect
  // *external* pivot changes (a data-point click, the reset button) as
  // opposed to our own per-frame writes from arrow traversal / panning.
  const lastStorePivot = useRef(livePivot.current.clone());

  // Drag-to-pan state. Refs (not state) since they're written on every
  // pointermove during a drag — using React state here would re-render
  // on every pixel of mouse movement.
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // Pushes livePivot's current value out to the store (so the HUD and
  // OrbitControls' target follow) and records it into lastStorePivot (so
  // the external-change check in useFrame doesn't mistake our own write
  // for an external one on the next frame). Called after every place that
  // moves livePivot directly: pan dragging, keyboard traversal, and the
  // external-pivot-change branch below — previously each repeated both
  // lines inline.
  const syncPivot = () => {
    setPivot([livePivot.current.x, livePivot.current.y, livePivot.current.z]);
    lastStorePivot.current.copy(livePivot.current);
  };

  // Registers raw browser keyboard listeners once, when this component
  // first mounts. We use native addEventListener here instead of React
  // event props because keyboard input needs to work globally (anywhere
  // on the page), not just when a specific element is focused.
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Only recognized movement keys are tracked — checking `key in
      // heldKeys` first stops an arbitrary key (CapsLock, Escape, etc.)
      // from getting added to the object as a new property.
      if (!(key in heldKeys)) return;
      // Arrows and space normally scroll the page — swallow that so
      // pivot traversal doesn't also drag the viewport around.
      if (PREVENT_DEFAULT_KEYS.has(key)) e.preventDefault();
      heldKeys[key] = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!(key in heldKeys)) return;
      heldKeys[key] = false;
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

  // Mouse-drag panning — active only while the "pan" tool is selected
  // (see Toolbar.tsx's hand-tool toggle). Registered directly on the
  // canvas element (gl.domElement), not window, so a drag that starts
  // over the Toolbar/HUD doesn't also pan the scene.
  useEffect(() => {
    const canvas = gl.domElement;

    const stopPanning = (e: PointerEvent) => {
      if (!isPanning.current) return;
      isPanning.current = false;
      // releasePointerCapture throws if the pointer ID was never
      // captured (e.g. this fires from pointercancel/lostpointercapture
      // rather than a normal pointerup) — guard defensively rather than
      // letting a stray call break the drag-end cleanup.
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (useStore.getState().activeTool !== "pan") return;
      isPanning.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };

      // Camera's local right/up axes in world space — panning along
      // these (rather than fixed world axes) keeps drag direction
      // correct regardless of current orbit angle, same as Figma/Maps.
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
        camera.quaternion,
      );
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      // Scale pixel movement by camera-to-pivot distance, so panning
      // feels consistent whether zoomed in tight or pulled back.
      const distance = camera.position.distanceTo(livePivot.current);
      const scale =
        (PAN_SPEED_AT_REFERENCE * distance) / PAN_REFERENCE_DISTANCE;

      // Grab-and-drag convention: dragging right/down should make the
      // scene appear to slide right/down, which means the CAMERA moves
      // left/up — opposite the drag direction.
      const worldDelta = new THREE.Vector3()
        .addScaledVector(right, -dx * scale)
        .addScaledVector(up, dy * scale);

      // Move camera and pivot together (a pure translation, no rotation
      // change) — same rigid-translation pattern as arrow-key traversal
      // below, which is what keeps this from fighting with the
      // camera.lookAt() call in the main useFrame loop.
      livePivot.current.add(worldDelta);
      camera.position.add(worldDelta);
      syncPivot();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    // pointerup: normal end of a drag.
    canvas.addEventListener("pointerup", stopPanning);
    // pointercancel: the browser aborts the pointer sequence (e.g. a
    // system gesture, pen entering hover, or an OS-level interruption)
    // without a matching pointerup — without this, isPanning could get
    // stuck true and the camera would keep "dragging" after the mouse
    // button is no longer actually held.
    canvas.addEventListener("pointercancel", stopPanning);
    // lostpointercapture: fires whenever this element's pointer capture
    // ends for any reason (including the two above, but also cases
    // neither of them covers) — a second safety net for the same
    // stuck-panning failure mode.
    canvas.addEventListener("lostpointercapture", stopPanning);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", stopPanning);
      canvas.removeEventListener("pointercancel", stopPanning);
      canvas.removeEventListener("lostpointercapture", stopPanning);
    };
  }, [camera, gl, setPivot]);

  // useFrame (from R3F) runs this callback once per rendered frame —
  // typically 60 times per second. `delta` is the time in seconds since
  // the last frame, used below to make movement speed independent of
  // frame rate (so it moves at the same real-world speed whether the
  // browser renders at 30fps or 144fps).
  useFrame((_, delta) => {
    // 0a. EXTERNAL PIVOT CHANGE (clicking a data point, the reset button)
    // Read the store imperatively — the true current value, unaffected by
    // React re-render timing (the reason the marker used to lag). If it
    // differs from what we last observed, another component moved the
    // pivot; translate the camera by that same offset. A pure translation
    // preserves the camera's rotation — the new pivot lands at the exact
    // screen position the old one held, rather than the camera whipping
    // around to face it.
    const [sx, sy, sz] = useStore.getState().pivot;
    if (
      sx !== lastStorePivot.current.x ||
      sy !== lastStorePivot.current.y ||
      sz !== lastStorePivot.current.z
    ) {
      const store = new THREE.Vector3(sx, sy, sz);
      camera.position.add(
        new THREE.Vector3().subVectors(store, livePivot.current),
      );
      livePivot.current.copy(store);
      lastStorePivot.current.copy(store);
    }

    // 0b. PIVOT TRAVERSAL (arrows / space / shift)
    // Each axis pairs two keys into a -1/0/+1 direction:
    //   Left/Right  -> x (orig-bytes axis)
    //   Space/Shift -> y (invel-pps axis: space rises, shift descends)
    //   Up/Down     -> z (invel-bpp axis)
    // The live pivot and camera move together by the same offset (a
    // rotation-preserving translation). syncPivot() records the write
    // immediately so step 0a doesn't mistake our own change for an
    // external one next frame.
    const move = new THREE.Vector3(
      (heldKeys.arrowright ? 1 : 0) - (heldKeys.arrowleft ? 1 : 0),
      (heldKeys[" "] ? 1 : 0) - (heldKeys.shift ? 1 : 0),
      (heldKeys.arrowup ? 1 : 0) - (heldKeys.arrowdown ? 1 : 0),
    );
    if (move.lengthSq() > 0) {
      move.multiplyScalar(PIVOT_SPEED * delta);
      livePivot.current.add(move);
      camera.position.add(move);
      syncPivot();
    }

    // 1. ZOOM logic (W/S)
    // Computes the straight-line direction FROM the camera TO the pivot,
    // as a unit vector (length 1, via .normalize()). Multiplying this
    // direction by MOVE_SPEED * delta and adding it to the camera's
    // position moves the camera along that line — toward the pivot for
    // W, away from it for S (negative scale).
    const direction = new THREE.Vector3()
      .subVectors(livePivot.current, camera.position)
      .normalize();
    if (heldKeys.w) {
      camera.position.addScaledVector(direction, MOVE_SPEED * delta);
    }
    if (heldKeys.s) {
      camera.position.addScaledVector(direction, -MOVE_SPEED * delta);
    }

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
        livePivot.current,
      );
      const angle = ROTATION_SPEED * delta * (heldKeys.a ? 1 : -1);

      // applyAxisAngle rotates a vector around a given axis by a given
      // angle (in radians). WORLD_UP is the Y axis (straight up), so
      // this spins relativePos horizontally around the pivot.
      relativePos.applyAxisAngle(WORLD_UP, angle);

      // Add the rotated relative position back onto the pivot to get
      // the camera's new absolute position in the scene.
      camera.position.copy(livePivot.current).add(relativePos);
    }

    // 3. Always look at the pivot
    // Runs every frame regardless of which keys are held, so the camera
    // stays pointed at the pivot even as its position changes above.
    // NOTE: this currently runs alongside OrbitControls (in App.tsx),
    // which also repositions/reorients the camera on mouse drag. Since
    // both systems mutate the camera independently within the same
    // frame loop, they can drift out of sync with each other — see
    // issue #5/#7 for the planned fix.
    camera.lookAt(livePivot.current);

    // 4. Drive the pivot cross marker imperatively, from the same live
    // value the camera uses — so the marker moves in the exact same frame
    // as the camera, with no React-state round-trip to lag behind.
    pivotMarkerRef.current?.position.copy(livePivot.current);
  });

  return null;
}
