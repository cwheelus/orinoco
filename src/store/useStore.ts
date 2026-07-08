import { create } from "zustand";

interface DataPoint {
  uid: string;
  x: number;
  y: number;
  z: number;
  className: string;
}

interface VisualizerState {
  pivot: [number, number, number];
  hoveredPoint: DataPoint | null;
  setPivot: (p: [number, number, number]) => void;
  setHoveredPoint: (p: DataPoint | null) => void;
}

export const useStore = create<VisualizerState>((set) => ({
  pivot: [0, 0, 0],
  hoveredPoint: null,
  setPivot: (pivot) => set({ pivot }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
}));
