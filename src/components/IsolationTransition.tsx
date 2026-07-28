import { useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";

// How long the isolate / revert zoom takes, in seconds.
const DURATION = 0.45;

// Decelerating ease — fast off the mark, settling gently, which reads as a
// camera move rather than a mechanical slide.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * IsolationTransition animates the jump between two grid mappings when an
 * octant is isolated (or cleared).
 *
 * Both mappings are of the form render = (value - CENTER) * SCALE, so the
 * change from one to the other is an affine transform:
 *
 *   render_old = render_new * (SCALE_old / SCALE_new)
 *                + (CENTER_new - CENTER_old) * SCALE_old
 *
 * Children re-render into the NEW mapping immediately; this wrapper then
 * applies that transform — which momentarily puts everything back where it
 * appeared under the OLD mapping — and relaxes it to identity. The result
 * is a smooth zoom into (or out of) the octant, achieved with one group
 * scale/position per frame instead of re-uploading point buffers.
 */
export function IsolationTransition({ children }: { children: ReactNode }) {
  const gridSpace = useStore((state) => state.gridSpace);
  const isolatedOctant = useStore((state) => state.isolatedOctant);
  const groupRef = useRef<THREE.Group>(null);

  // The previous frame-of-reference, so a change can be measured against
  // it. Updated only after an isolation change is handled.
  const prev = useRef({ gridSpace, isolatedOctant });
  // Active animation: starting scale/offset per axis, plus progress 0→1.
  const anim = useRef<{
    a: [number, number, number];
    b: [number, number, number];
    t: number;
  } | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = { gridSpace, isolatedOctant };
    // Only isolation changes animate. Other gridSpace recomputes (a new
    // CSV, a scaling-mode switch) can rescale by orders of magnitude,
    // where a "zoom" would read as a wild swoop rather than a transition.
    if (before.isolatedOctant === isolatedOctant) return;

    const So = before.gridSpace.SCALE;
    const Co = before.gridSpace.CENTER;
    const Sn = gridSpace.SCALE;
    const Cn = gridSpace.CENTER;
    // Guard against a degenerate old scale (e.g. the empty initial grid).
    if (!(So.x > 0 && So.y > 0 && So.z > 0)) return;

    anim.current = {
      a: [So.x / Sn.x, So.y / Sn.y, So.z / Sn.z],
      b: [
        (Cn.x - Co.x) * So.x,
        (Cn.y - Co.y) * So.y,
        (Cn.z - Co.z) * So.z,
      ],
      t: 0,
    };
  }, [gridSpace, isolatedOctant]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const a = anim.current;
    if (!a) return;

    a.t = Math.min(1, a.t + delta / DURATION);
    const e = easeOutCubic(a.t);
    // Interpolate the compensating transform toward identity.
    g.scale.set(
      a.a[0] + (1 - a.a[0]) * e,
      a.a[1] + (1 - a.a[1]) * e,
      a.a[2] + (1 - a.a[2]) * e,
    );
    g.position.set(a.b[0] * (1 - e), a.b[1] * (1 - e), a.b[2] * (1 - e));

    if (a.t >= 1) {
      // Land exactly on identity rather than an eased approximation, so no
      // residual sub-pixel offset survives the animation.
      g.scale.set(1, 1, 1);
      g.position.set(0, 0, 0);
      anim.current = null;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}
