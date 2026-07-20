import { useRef } from "react";
import type { Group } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Line } from "@react-three/drei";
import { useStore } from "./store/useStore";
import { PointCloud } from "./components/PointCloud";
import { CameraRig } from "./components/CameraRig";
import { Axes } from "./components/Axes";
import { CartesianGrid } from "./components/CartesianGrid";
import { classColors, DEFAULT_CLASS_COLOR } from "./lib/classColors";

/**
 * Orinoco Flow Visualizer - Main Application Entry
 *
 * ARCHITECTURE:
 * - UI Layer: HTML/Tailwind over the 3D Canvas (zIndex: 10)
 * - 3D Layer: React Three Fiber (R3F) for WebGL rendering
 * - State: Zustand store (useStore) for cross-component sync (pivoting, hovering)
 *
 * This file renders two layers stacked on top of each other: a flat 2D
 * HTML layer (text, buttons, info panels) and a 3D <Canvas> layer
 * beneath it (the navigable scene). The two layers never reference each
 * other directly — both read from the same Zustand store, so state
 * changes in one (e.g. a 3D point being hovered) can update the other
 * (the 2D HUD panel) without any direct coupling between them.
 */
function App() {
  // "pivot": the point the camera currently orbits around. Starts at
  // the world origin (0,0,0) and updates when a data point is clicked
  // (see PointCloud.tsx's onClick handler).
  const pivot = useStore((state) => state.pivot);
  // The data point object currently under the cursor, or null if
  // nothing is being hovered. Drives the conditional HUD panel below.
  const hoveredPoint = useStore((state) => state.hoveredPoint);
  // Reads the setPivot action from the shared store (see useStore.ts).
  // Used below by the Reset Pivot button to return the camera's orbit
  // target back to the world origin, independent of PointCloud.tsx's
  // onClick handler, which is the only other place this setter is called.
  const setPivot = useStore((state) => state.setPivot);
  // Ref to the pivot cross marker group below. CameraRig drives its
  // position imperatively every frame (in lockstep with the camera), so
  // the marker is intentionally NOT bound to the `pivot` state — a state
  // binding lags a frame behind the imperative camera movement.
  const pivotMarkerRef = useRef<Group>(null);
  return (
    <div className="w-screen h-screen bg-slate-900 relative">
      {/* 
          1. HUD OVERLAY (2D)
          'pointer-events-none' is critical here: it allows clicks to "pass through" 
          the UI layer into the 3D Canvas unless specifically overridden by a
          child element that sets its own pointer-events value.
      */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
        {/* Branding & Status Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-black tracking-tighter uppercase text-white">
              Orinoco <span className="text-blue-500">Flow</span>
            </h1>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
            v1.0.0 // Sentient Solutions // Internal Systems
          </p>
        </div>

        {/* Dynamic Point Inspector: only renders when hoveredPoint is
            truthy (i.e. a point is currently being hovered). Uses `&&`
            rather than a ternary since there's no fallback content to
            show otherwise. */}
        <div className="w-72">
          {hoveredPoint && (
            <div className="p-4 bg-slate-900/80 backdrop-blur-md border-l-2 border-blue-500 ring-1 ring-white/10 shadow-2xl transition-all">
              <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">
                Point Analysis
              </p>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40 text-[10px]">UID</span>
                  <span className="text-white font-mono text-xs">
                    {hoveredPoint.uid}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-white/40 text-[10px]">
                    Classification
                  </span>
                  {/* Color driven by the shared classColors map (lib/classColors.ts)
                      rather than a fixed set of Tailwind classes, since the real
                      classes (normal/nss/qc/zt) use arbitrary hex values, not
                      Tailwind's built-in palette. */}
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{
                      color:
                        classColors[hoveredPoint.className] ??
                        DEFAULT_CLASS_COLOR,
                    }}
                  >
                    {hoveredPoint.className}
                  </span>
                </div>
                <div className="pt-1">
                  {/* Maps current hovered coordinates into a readable grid */}
                  <span className="text-white/40 text-[10px] block mb-1">
                    Metrics (X, Y, Z)
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-white/80">
                    <div className="bg-white/5 p-1 rounded">
                      E: {hoveredPoint.x.toFixed(3)}
                    </div>
                    <div className="bg-white/5 p-1 rounded">
                      C: {hoveredPoint.y.toFixed(3)}
                    </div>
                    <div className="bg-white/5 p-1 rounded">
                      W: {hoveredPoint.z.toFixed(3)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom HUD: Control Guide & Classification Legend */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          {/* Visual Keyboard Guide (Improves UX for non-gamers) */}
          <div className="bg-white/5 p-3 backdrop-blur-sm border border-white/10 rounded flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Orbit (A/D)
              </span>
              <div className="flex gap-1 text-white">
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  A
                </kbd>
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  D
                </kbd>
              </div>
            </div>
            <div className="w-[1px] bg-white/10 h-6 self-end mb-1" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Depth (W/S)
              </span>
              <div className="flex gap-1 text-white">
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  W
                </kbd>
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  S
                </kbd>
              </div>
            </div>
            <div className="w-[1px] bg-white/10 h-6 self-end mb-1" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Pivot (Arrows / Spc / Shift)
              </span>
              <div className="flex gap-1 text-white">
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  ←→↑↓
                </kbd>
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  Spc
                </kbd>
                <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold font-mono">
                  ⇧
                </kbd>
              </div>
            </div>
            <div className="w-[1px] bg-white/10 h-6 self-end mb-1" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Reset Pivot
              </span>
              <button
                onClick={() => setPivot([0, 0, 0])}
                className="pointer-events-auto px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 rounded text-[10px] font-bold font-mono text-blue-300 uppercase transition-colors"
              >
                Origin
              </button>
            </div>
          </div>

          {/* Color Key: generated directly from lib/classColors.ts (the same
              map PointCloud.tsx uses for sphere colors), so the legend can
              never drift out of sync with what's actually rendered — see
              issue #2 for the longer-term plan to derive this from an
              uploaded color-mapping file instead of a hardcoded map. */}
          <div className="bg-black/60 p-3 ring-1 ring-white/10 rounded">
            <div className="flex gap-4">
              {Object.entries(classColors).map(([className, color]) => (
                <div key={className} className="flex items-center gap-2">
                  <div
                    className="w-2 h-4 rounded-sm"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                  <span className="text-[10px] uppercase font-bold text-white/80 tracking-widest">
                    {className}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 
          2. THE 3D CANVAS (RENDER ENGINE)
          'shadows' enabled for high fidelity (optional).
      */}
      <Canvas shadows>
        {/* Sets the camera's starting position before any user input.
            [5,4,5] keeps the -2..2 grid box comfortably in frame — an
            earlier value of [20,20,20] made the box look too small. */}
        <PerspectiveCamera makeDefault position={[5, 4, 5]} />

        {/* Lighting: a strong ambient floor so every data point is
            passively visible anywhere in the box (meshStandardMaterial
            renders near-black without light), plus one weak point light
            kept purely for directional shading — the subtle bright/dark
            gradient across each sphere that makes it read as a 3D ball
            instead of a flat disc. */}
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />

        {/* Draws the open-face reference box + axis ticks/labels. Two
            separate components since each has one responsibility:
            CartesianGrid draws the box geometry, Axes draws the ticks,
            numbers, and axis names along its edges. */}
        <CartesianGrid />

        {/* 
            ENGINE COMPONENTS:
            CameraRig: Custom keyboard logic for WASD
            PointCloud: Mapped 3D nodes from dataset
            Axes: 3D labels (Billboarded to stay readable)
        */}
        <CameraRig pivotMarkerRef={pivotMarkerRef} />
        <PointCloud />
        <Axes />

        {/* 
            OrbitControls: Standard mouse rotation/pan.
            'target={pivot}' ensures the mouse rotates around the currently
            selected point. NOTE: this runs alongside CameraRig.tsx's own
            camera.lookAt() call every frame — see the note in CameraRig.tsx
            about the resulting drift issue (tracked in #5/#7).
        */}
        <OrbitControls target={pivot} makeDefault />

        {/*
            TACTICAL PIVOT MARKER:
            Visual feedback identifying the 'center' of the world — a
            six-armed cross: one line segment through the pivot along each
            of the three axes (so two arms per axis, six total). Unlike
            the previous billboarded ring, the cross is a real 3D object
            whose arms foreshorten with perspective, which doubles as an
            orientation cue for which way each axis runs while traversing
            the pivot with the arrow keys.

            Position is driven imperatively by CameraRig via pivotMarkerRef
            (not `position={pivot}`), so it tracks the camera in the exact
            same frame instead of lagging a frame behind on React state.
        */}
        <group ref={pivotMarkerRef}>
          <Line
            points={[
              [-0.15, 0, 0],
              [0.15, 0, 0],
            ]}
            color="#3b82f6"
            lineWidth={2}
            transparent
            opacity={0.8}
          />
          <Line
            points={[
              [0, -0.15, 0],
              [0, 0.15, 0],
            ]}
            color="#3b82f6"
            lineWidth={2}
            transparent
            opacity={0.8}
          />
          <Line
            points={[
              [0, 0, -0.15],
              [0, 0, 0.15],
            ]}
            color="#3b82f6"
            lineWidth={2}
            transparent
            opacity={0.8}
          />
          {/* Subtl light cast by the pivot marker to illuminate nearby nodes */}
          <pointLight distance={3} intensity={5} color="#3b82f6" />
        </group>
      </Canvas>
    </div>
  );
}

export default App;
