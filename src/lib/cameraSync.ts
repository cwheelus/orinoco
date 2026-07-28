import * as THREE from "three";

/**
 * cameraSync.ts
 *
 * A one-value channel carrying the main camera's current orientation out
 * to things rendered OUTSIDE the main Canvas — specifically the Isolate
 * page's octant gizmo, which lives in its own small Canvas inside the
 * Toolbar's HTML panel and has to face the same way as the main grid.
 *
 * Deliberately NOT Zustand state: this updates every frame, and pushing
 * that through the store would re-render every subscriber 60×/second. A
 * plain mutable object read inside the gizmo's own useFrame keeps the sync
 * per-frame and allocation-free without touching React at all.
 */
export const cameraOrientation = new THREE.Quaternion();
