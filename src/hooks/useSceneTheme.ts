import { useStore } from "../store/useStore";
import { getSceneTheme, type SceneTheme } from "../lib/sceneTheme";

/**
 * React Hook for bridging global application theme state (Zustand) to Three.js / R3F components.
 *
 * Performance & Rendering Notes:
 * - Subscribes specifically to state slice (`state.darkMode`) to minimize unnecessary React re-renders.
 * - Resolves theme tokens cleanly so sub-components can destructure exact color contracts
 *   (e.g., `const { scene, interaction } = useSceneTheme();`).
 *
 * @returns Active `SceneTheme` color token object for the current scene mode.
 *
 * @example
 * ```tsx
 * function CartesianGrid() {
 *   const { scene } = useSceneTheme();
 *   return <gridHelper args={[10, 10, scene.gridMajor, scene.gridMinor]} />;
 * }
 * ```
 */
export function useSceneTheme(): SceneTheme {
  return useStore((state) => getSceneTheme(state.darkMode ? "dark" : "light"));
}
