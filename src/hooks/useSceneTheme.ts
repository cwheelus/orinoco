import { useStore } from "../store/useStore";
import { getSceneTheme, type SceneTheme } from "../lib/sceneTheme";

export function useSceneTheme(): SceneTheme {
  // Selects stable reference (sceneTheme.dark or sceneTheme.light)
  return useStore((s) => getSceneTheme(s.darkMode ? "dark" : "light"));
}
