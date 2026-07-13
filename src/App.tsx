import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  PerspectiveCamera,
  Billboard,
} from "@react-three/drei";
import { useStore } from "./store/useStore";
import { PointCloud } from "./components/PointCloud";
import { CameraRig } from "./components/CameraRig";
import { Axes } from "./components/Axes";

/**
 * Orinoco Flow Visualizer - Main Application Entry
 *
 * ARCHITECTURE:
 * - UI Layer: HTML/Tailwind over the 3D Canvas (zIndex: 10)
 * - 3D Layer: React Three Fiber (R3F) for WebGL rendering
 * - State: Zustand store (useStore) for cross-component sync (pivoting, hovering)
 *
 * IN PLAIN TERMS:
 * This file builds the entire screen the user sees. It has two layers stacked
 * on top of each other: a flat 2D layer (the on-screen text, buttons, and info
 * panels) and a 3D layer underneath it (the actual navigable graph/scene).
 * The two layers don't talk to each other directly — instead they both read
 * from a shared "notebook" (the Zustand store) so that, for example, hovering
 * over a 3D point can update the 2D info panel without the two pieces of code
 * needing to know about each other.
 */
function App() {
  // Global State: Coordinates for the focal center of the 3D world
  // "pivot" is the point the camera currently orbits around. It starts at
  // the very center (0,0,0) and can change if the user clicks a data point.
  const pivot = useStore((state) => state.pivot);
  // Global State: The data object currently under the user's cursor
  // This is null when nothing is being hovered, and becomes a real data
  // point object the moment the mouse moves over one in the 3D scene.
  const hoveredPoint = useStore((state) => state.hoveredPoint);

  return (
    <div className="w-screen h-screen bg-slate-900 relative">
      {/* 
          1. HUD OVERLAY (2D)
          'pointer-events-none' is critical here: it allows clicks to "pass through" 
          the UI layer into the 3D Canvas unless specifically overridden.

          IN PLAIN TERMS: this is the flat, on-screen layer with text and panels.
          Setting it to ignore clicks means the user can still click through it
          to interact with the 3D scene underneath, even though this layer is
          visually on top.
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

        {/* Dynamic Point Inspector: Appears only when user hovers over a 3D node */}
        {/* 
            IN PLAIN TERMS: this box shows details about whatever data point
            the mouse is currently over. If nothing is being hovered, it shows
            a placeholder message instead (see the "else" branch below).
        */}
        <div className="w-72">
          {hoveredPoint ? (
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
                  {/* Class colors mirrored from Charles' documentation (Slide 15) */}
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      hoveredPoint.className === "attack"
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
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
          ) : (
            // Placeholder shown when the user isn't hovering over any point
            <div className="p-4 bg-slate-900/40 border-l-2 border-white/10 italic text-white/20 text-[10px] w-fit">
              Secure Link Established // Hover nodes for analysis
            </div>
          )}
        </div>

        {/* Bottom HUD: Control Guide & Classification Legend */}
        {/* IN PLAIN TERMS: this is the on-screen cheat sheet showing the
            keyboard controls and what each data point color means. */}
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
          </div>

          {/* Color Key: Defined by the Sentient.Solutions Class File Schema */}
          <div className="bg-black/60 p-3 ring-1 ring-white/10 rounded">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-[#CC0000] rounded-sm shadow-[0_0_8px_#CC0000]" />
                <span className="text-[10px] uppercase font-bold text-white/80 tracking-widest">
                  Attack
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-[#00CC00] rounded-sm shadow-[0_0_8px_#00CC00]" />
                <span className="text-[10px] uppercase font-bold text-white/80 tracking-widest">
                  Normal
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-[#FFFFFF] rounded-sm shadow-[0_0_8px_#FFFFFF]" />
                <span className="text-[10px] uppercase font-bold text-white/80 tracking-widest">
                  Unknown
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 
          2. THE 3D CANVAS (RENDER ENGINE)
          'shadows' enabled for high fidelity (optional).

          IN PLAIN TERMS: everything inside <Canvas> is the actual 3D scene —
          this is where the graph, the data points, and the camera all live.
      */}
      <Canvas shadows>
        {/* Default Scene Perspective: [15,15,15] gives a good isometric entry view */}
        {/* This sets where the camera starts before the user moves it. */}
        <PerspectiveCamera makeDefault position={[20, 20, 20]} />

        {/* Lighting: Balanced to ensure glow (emissive) points aren't washed out */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        {/* Navigational Grid: Visual reference for the Cartesian plane */}
        {/* IN PLAIN TERMS: this draws the faint floor grid so the user has
            some sense of scale and orientation while moving around. */}
        <Grid
          infiniteGrid
          sectionSize={5}
          sectionColor="#333333"
          cellColor="#111111"
          fadeDistance={100}
        />

        {/* 
            ENGINE COMPONENTS:
            CameraRig: Custom keyboard logic for WASD
            PointCloud: Mapped 3D nodes from dataset
            Axes: 3D labels (Billboarded to stay readable)

            IN PLAIN TERMS: these three pieces do the real work — one handles
            keyboard movement, one draws all the data points, and one draws
            the axis labels around the scene.
        */}
        <CameraRig />
        <PointCloud />
        <Axes />

        {/* 
            OrbitControls: Standard mouse rotation/pan.
            'target={pivot}' ensures the mouse rotates around the currently selected point.
        */}
        <OrbitControls target={pivot} makeDefault />

        {/* 
            TACTICAL PIVOT RETICLE:
            Visual feedback identifying the 'center' of the world.
            Uses Billboard to remain visible regardless of camera angle.

            IN PLAIN TERMS: this is the glowing blue ring/diamond marker that
            shows exactly where the camera is currently centered on/orbiting
            around. It always faces the camera so it's visible from any angle.
        */}
        <group position={pivot}>
          <Billboard>
            <mesh>
              <ringGeometry args={[0.25, 0.28, 32]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <ringGeometry args={[0.35, 0.38, 4]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
            </mesh>
          </Billboard>
          {/* Subtl light cast by the pivot marker to illuminate nearby nodes */}
          <pointLight distance={3} intensity={5} color="#3b82f6" />
        </group>
      </Canvas>
    </div>
  );
}

export default App;
