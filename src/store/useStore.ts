import { create } from "zustand";

// Shape of a single data point loaded from data.json.
// IN PLAIN TERMS: this describes what information exists for each dot
// in the 3D scene — its ID, its position, and what category it belongs to.
interface DataPoint {
  uid: string;
  x: number;
  y: number;
  z: number;
  className: string;
}

// Shape of the entire shared state store.
// IN PLAIN TERMS: this is the "notebook" that different parts of the app
// (the 3D scene and the 2D HUD) both read from and write to, so they can
// stay in sync without talking to each other directly.
interface VisualizerState {
  // The point in 3D space the camera currently orbits around and looks at.
  pivot: [number, number, number];
  // Whichever data point the mouse is currently hovering over, or null
  // if nothing is being hovered.
  hoveredPoint: DataPoint | null;
  // Function to change the current pivot point.
  setPivot: (p: [number, number, number]) => void;
  // Function to change which point is currently being hovered.
  setHoveredPoint: (p: DataPoint | null) => void;
}

// Creates the actual shared store, with its starting values and the
// functions used to update it. Any component can call useStore() to read
// from this or call one of the setters to update it — see PointCloud.tsx
// (which writes to this) and App.tsx (which reads from this).
export const useStore = create<VisualizerState>((set) => ({
  // Starting pivot: the world origin, per the project spec.
  pivot: [0, 0, 0],
  // Nothing is hovered when the app first loads.
  hoveredPoint: null,
  setPivot: (pivot) => set({ pivot }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
}));
