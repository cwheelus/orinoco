import { create } from "zustand";

// Shape of a single data point loaded from data.json. Note: current
// fields (x/y/z/className) don't match the spec's actual schema
// (in-entropy/in-conv/in-WHT-score/class) — this is placeholder test
// data pending issue #2's data normalization work.
interface DataPoint {
  uid: string;
  x: number;
  y: number;
  z: number;
  className: string;
}

// Shape of the entire shared state store. This is the single source of
// truth that both the 3D scene (inside <Canvas>) and the 2D HUD
// (outside <Canvas>, in App.tsx) read from — since those are separate
// React trees that don't otherwise have a way to pass props to each
// other directly.
interface VisualizerState {
  // The point in 3D space the camera currently orbits around and looks
  // at. Read by CameraRig.tsx (for WASD movement math) and by
  // OrbitControls in App.tsx (for mouse-drag rotation target).
  pivot: [number, number, number];
  // Whichever data point the mouse is currently hovering over, or null
  // if nothing is being hovered. Read by App.tsx to conditionally show
  // the "Point Analysis" HUD panel.
  hoveredPoint: DataPoint | null;
  // Updates the pivot. Called from PointCloud.tsx's onClick handler.
  setPivot: (p: [number, number, number]) => void;
  // Updates hoveredPoint. Called from PointCloud.tsx's onPointerOver/
  // onPointerOut handlers.
  setHoveredPoint: (p: DataPoint | null) => void;
}

// create() from Zustand returns a React hook (useStore) that any
// component can call to read from or write to this shared state,
// without needing a <Provider> wrapper or prop drilling. The function
// passed to create() receives `set` (used to update state) and returns
// the initial state plus the setter functions.
export const useStore = create<VisualizerState>((set) => ({
  // Starting pivot: the world origin, per the project spec — the
  // camera should default to orbiting (0,0,0) until a point is clicked.
  pivot: [0, 0, 0],
  // Nothing is hovered when the app first loads.
  hoveredPoint: null,
  setPivot: (pivot) => set({ pivot }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
}));
