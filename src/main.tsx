import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Entry point for the whole application. Finds the empty <div id="root">
// in index.html and tells React to render the App component tree inside
// it — this is the first code that actually runs in the browser.
//
// StrictMode is a development-only wrapper from React that intentionally
// double-invokes certain functions (like component render and effects)
// to help surface bugs from side effects that aren't properly cleaned up.
// It has no effect in the production build.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
