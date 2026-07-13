import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Entry point for the whole application.
// IN PLAIN TERMS: this is the very first code that runs. It finds the
// empty <div id="root"> in the page's HTML and tells React to render
// the entire app (starting with App.tsx) inside it.
//
// StrictMode is a development-only helper from React that double-checks
// for common mistakes; it has no effect in the final production build.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
