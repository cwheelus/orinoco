# Project Orinoco // 3D Cyber Threat Intelligence Visualizer

Project Orinoco is a browser-native 3D visualization tool for exploring network telemetry. It projects selected traffic features into a three-dimensional Cartesian space, allowing analysts to inspect individual observations, navigate spatial relationships, and investigate clusters interactively.

The application visualizes network flow features within a symmetric, signed 3D Cartesian coordinate system — every axis runs through the origin, so data-zero is always visible regardless of whether the loaded dataset is all-positive, all-negative, or mixed. Analysts can navigate the environment, inspect individual data points, isolate a spatial octant for focused analysis, and dynamically adjust their exploration viewpoint through an interactive pivot system. Camera movement is always relative to the active pivot. Any CSV containing at least two numeric columns and at least one text column can be loaded directly in-browser via the toolbar — the application starts blank, with no bundled or auto-loaded dataset.

---

# Preview

## Application Demo

**Demo Videos:**
[Watch Orinoco MVP Walkthrough 7/8/2026](https://youtu.be/Gr2Yjx_JF_4)
[Watch Orinoco MVP Walkthrough 7/20/2026](https://youtu.be/_KvzO14yMGE)
[Watch Orinoco Signed Grid & Octant Isolation Walkthrough](https://youtu.be/tIFLs0QYwfM)
[Watch Orinoco Point Transparency & Axis Mapping Demo](https://github.com/user-attachments/assets/9858e940-f40c-4ced-95c5-f708c1d76758)

Example walkthrough:

- Navigate the 3D environment using keyboard and mouse controls
- Hover over threat nodes to inspect metadata
- Select nodes to change the active pivot location
- Isolate a spatial octant to focus on one corner of the data
- Load a new CSV dataset directly from the toolbar, with the grid, axis labels, and points all updating to match

---

## Screenshots

> **Note:** the screenshots below predate the signed-grid/octant-isolation rework (PR #42) and are pending an update. See the demo videos above for the current UI in the meantime.

### Main Visualization View

![Main Visualization](docs/images/main.png)
_(placeholder — screenshot to be retaken)_

### Point Inspection HUD

![Point Inspection HUD](docs/images/data_info.png)
_(placeholder — screenshot to be retaken)_

---

# Use Cases

Project Orinoco supports exploratory analysis when network behavior is easier to understand spatially than in a flat table or dashboard.

- **Investigate anomalous traffic** — Plot flow metrics such as packet rate, byte volume, and bytes per packet to find observations that sit far from normal traffic patterns.
- **Explore clusters and outliers** — Navigate dense groups in three dimensions, inspect individual points, and use the pivot system to examine local relationships from different viewpoints.
- **Compare traffic classes** — Color-coded classifications make it easier to see where normal and suspicious activity overlap, separate, or form distinct regions.
- **Focus on a region of interest** — Combine class filters, numeric range filters, and octant isolation to reduce visual noise and investigate a specific subset of the dataset.
- **Test feature combinations** — Load a CSV and remap numeric columns to the X, Y, and Z axes to evaluate which feature combinations reveal useful structure.
- **Communicate investigation findings** — Use the interactive scene as a shared visual reference when explaining an outlier, cluster, or traffic pattern to other analysts.

Project Orinoco is intended as an exploratory visualization aid. It complements—not replaces—detection rules, statistical analysis, and established incident-response workflows.

---

# Key Features

## Symmetric 3D Cartesian Plot Visualization

Project Orinoco renders high-dimensional network features in an interactive WebGL environment using Three.js and React Three Fiber.

Every axis is symmetric and signed — the display range for each axis is always `[-M, +M]`, where `M` is derived from the dataset's farthest value on that axis (plus a 10% margin, rounded outward). Data-zero therefore always sits at the exact center of the plotting volume, and both positive and negative values are visible regardless of the dataset's actual sign distribution. This replaces an earlier floor-anchored, open-face box design.

The reference frame is drawn in two parts:

- **`CartesianGrid.tsx`** — a single horizontal grid plane positioned at data-zero's render height (the box center for the full grid), plus a faint full 12-edge wireframe box outlining the plotting volume for depth reference
- **`Axes.tsx`** — the three bold coordinate axes, each running the full length of its axis through the origin with an arrowhead and a single column-name title at the positive end, plus adaptive tick marks

Each axis is independently scaled to the dataset's numeric range by default — tick labels always reflect real data-space values, and recompute automatically whenever a new dataset loads or the scaling mode changes (see **Scaling Modes** below).

Example axis mapping for a typical network-flow CSV:

| Feature    | Axis |
| ---------- | ---- |
| invel_pps  | Y    |
| orig_bytes | X    |
| invel_bpp  | Z    |

Column names and axis assignment are entirely dataset-driven — see **Dynamic Dataset Loading** below.

---

## Dynamic Dataset Loading

Analysts load any CSV directly in-browser via the toolbar's file picker — the parser auto-detects numeric and text columns, maps them to axes automatically, and reports specific errors for malformed files rather than failing silently. The app starts blank (#57): no dataset is bundled or auto-loaded.

See [USER_GUIDE.md's "Loading Your Own CSV Dataset"](USER_GUIDE.md#7-loading-your-own-csv-dataset) for the expected format, loading steps, manual axis mapping, and error handling.

---

## Tactical Navigation

WASD orbit/dolly, arrow-key/space/shift pivot traversal, and mouse orbit/pan/click-to-pivot — with a locked, flat top-down camera for 2D (Z-less) datasets, plus zoom/pivot/tilt guardrails against runaway camera movement.

See [USER_GUIDE.md's "Navigating the 3D Scene"](USER_GUIDE.md#4-navigating-the-3d-scene) for the full keyboard/mouse reference and 2D mode behavior.

---

## Dynamic Pivot System

Users can select any data node as an investigation reference point, or move the pivot directly with the arrow/space/shift keys.

When the pivot changes:

1. The global pivot coordinate updates in the shared store
2. The camera translates by the same offset that the pivot moved — rotation is preserved, so the new pivot lands at the same screen position the old one held rather than the camera whipping around to face it
3. The tactical reticle (a six-armed cross) tracks the new position
4. Analysts can explore nearby data relationships from the new vantage point

**Lockstep marker tracking:** the pivot marker is driven imperatively by `CameraRig.tsx`, in the same per-frame update as the camera itself, rather than being bound to React state. A state-driven marker lagged a frame behind the camera's own imperative movement, since store updates commit asynchronously relative to the render-frame loop — the imperative approach eliminates that lag entirely.

Isolating an octant (see below) also resets the pivot to the origin, since the old pivot was a coordinate in the pre-isolation mapping and no longer corresponds to the same data.

---

## Interactive Point Inspection

Interactive 3D events provide metadata inspection through the Heads-Up Display (HUD).

Displayed information includes:

- UID
- Classification
- XYZ coordinates
- Feature values, labeled with the active dataset's real column names

---

## SOC-Inspired Interface

The interface uses a security operations center inspired design with high-contrast visualization and a glass-morphism HUD.

Built-in classification colors:

| Data Value | Color     |
| ---------- | --------- |
| `normal`   | `#dddddd` |
| `nss`      | `#dd0000` |
| `qc`       | `#00dd00` |
| `zt`       | `#0000dd` |

A loaded CSV's own class values inherit these colors where names match. Any other class gets a color generated deterministically from its name — the same class name always produces the same color, on every reload and every dataset.

---

## Grid Display & Scaling

The Grid page in the Toolbar controls how the reference grid and axes are presented and scaled.

- **Show grid** — toggles the wireframe box and grid plane; axis lines, tick marks, and labels remain visible regardless, since coordinate reference stays useful even without the box geometry
- **Per-axis tick label visibility** — each of the three axes' tick marks and numeric labels can be hidden independently
- **Tick density** — a slider (3–30 by default, range and step configurable via `config.json`'s `limits.tickDensitySlider`) controlling how many tick marks appear per axis; the actual step size is rounded to a "nice" 1–2–5 number so labels stay human-readable. Tick marks and numbers scale per-frame by camera distance to hold a constant on-screen size rather than ballooning on approach
- **Scaling modes** — see below

### Scaling Modes

`computeGridSpace()` accepts a `ScalingConfig` that determines each axis's half-extent (`M`):

| Mode                          | Behavior                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-normalized** (default) | Per-axis `M`, derived independently from each axis's own farthest value. Good for comparing shape when magnitudes differ wildly across axes.                                                                                    |
| **Auto-real scale**           | One shared `M`, derived from the single farthest value across all axes — a unit of data renders as the same length on every axis (true relative distances). Small-range axes bunch near the origin rather than filling the box. |
| **Custom**                    | A typed ± bound per axis; any axis left blank or invalid falls back to its auto-normalized value.                                                                                                                               |

Mode and bound changes recompute the grid live.

---

## Octant Isolation

The Isolate page in the Toolbar lets an analyst focus on one spatial corner (octant) of the data.

A small 3D gizmo (`OctantGizmo.tsx`) — eight cubes in a wireframe outline — mirrors the main view's rotation in lockstep, so whichever cube occupies a given on-screen position is the octant currently facing the camera there.

| Action                                    | Result                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Click a cube                              | That octant enlarges to fill the entire grid; all points outside it are hidden |
| Click the same cube again                 | Reverts to the full grid (toggle)                                              |
| Click inside the outline but off any cube | Reverts to the full grid                                                       |
| Click Reset                               | Reverts to the full grid                                                       |

**Implementation:** isolation is expressed purely as a change to each axis's display range — the selected octant's sides become one-sided (`[0, M]` or `[-M, 0]`) instead of the full `[-M, M]`. Since that range still maps onto the same fixed render box, the octant enlarges automatically and everything downstream follows for free: points reposition, tick numbers rescale and refine, and the axes reposition so data-zero sits at a box corner instead of the center. Points exactly at `0` on an isolated axis are assigned to the positive side, so the eight octants partition the dataset cleanly with no point counted twice.

**Transition:** because both the pre- and post-isolation mappings are the same affine transform (`(value − CENTER) × SCALE`), `IsolationTransition.tsx` re-renders children into the new mapping immediately, applies a compensating transform that puts everything back where it visually was, then eases that transform to identity over 450ms — a real zoom effect using one group scale/position per frame, with no instance-buffer re-upload, so it stays cheap at scale. The transition deliberately only animates octant changes; a new CSV load can rescale by orders of magnitude and would otherwise swoop unpredictably.

**Camera sync:** the gizmo reads a plain mutable quaternion (`lib/cameraSync.ts`), written by `CameraRig` every frame — deliberately not routed through the Zustand store, since a per-frame store write would re-render every store subscriber 60 times a second.

Isolation clears automatically whenever a new CSV loads, since an octant chosen against the old dataset says nothing about the new one.

---

## Toolbar

A Blender-style docked side panel with an icon strip providing access to visualization, data, navigation, and application controls, plus a resizable content pane for the selected control.

See [USER_GUIDE.md's "Using the Toolbar"](USER_GUIDE.md#6-using-the-toolbar) for the full icon reference and each page's controls.

---

## Data Filtering & Point Sizing

Class-visibility toggles, per-axis numeric range filters, and density-based point sizing — all rendered as a single instanced mesh, so filtering never remounts or reallocates.

See [USER_GUIDE.md's Data Page section](USER_GUIDE.md#data-page) for the full filter and sizing controls.

---

## Diagnostics Console

The Console page in the Toolbar (Terminal icon) shows a running log of every diagnostic raised during the session — dataset loads, color-file loads, remapped axes, and any errors or warnings along the way.

Each entry carries a stable, versioned code (e.g. `CSV-002`, `CLR-001`) rather than a free-text message alone, so a specific failure can be referenced consistently regardless of how its wording changes over time. Entries are grouped by severity:

| Severity | Meaning                                                                                    |
| -------- | ------------------------------------------------------------------------------------------ |
| Error    | The operation failed outright (e.g. a CSV with too few numeric columns)                    |
| Warning  | The operation succeeded, but some rows were excluded (e.g. a few rows with missing values) |
| Info     | The operation succeeded cleanly (e.g. a dataset loaded, or axes were remapped)             |

- The icon-strip Terminal button shows an unreviewed-issue badge (error/warning count) when the Console hasn't been opened since the last problem was logged; opening the page clears it
- Each entry can be expanded to show per-row detail — for large exclusion lists, this switches from listing every row to a per-cause summary (e.g. "12 rows: class is empty") so one bad column in a huge file doesn't flood the log
- The log is capped at a configurable number of entries per session (oldest dropped first) and can be cleared manually
- Color-file overrides are validated against the currently loaded dataset's actual classes: an override whose class name doesn't match anything in the dataset is flagged as a warning rather than applying silently

---

# Architecture

Project Orinoco separates rendering, application state, and interface responsibilities.

## Design Philosophy

Project Orinoco follows a separation-of-concerns architecture:

- React manages application structure and UI
- React Three Fiber manages 3D visualization
- Zustand manages shared interaction state, including the active dataset
- Data sources remain independent from rendering logic — any dataset matching the expected shape can be loaded without touching rendering components

This architecture allows the visualization engine to evolve as new threat datasets become available.

```mermaid
flowchart TB
    subgraph UI["2D HUD Layer - HTML/Tailwind"]
        Toolbar
        HUD["Point Analysis / Legend / Control Guide"]
    end
    subgraph R3F["3D Layer - React Three Fiber"]
        CartesianGrid
        Axes
        PointCloud
        OctantGizmo
        CameraRig
    end
    Store[("Zustand Store: pivot, hoveredPoint, dataPoints, gridSpace, axisLabels, gridVisible, activeTool, hiddenClasses, numericFilters, hiddenTickAxes, scalingMode, customBounds, isolatedOctant, tickDensity, logEntries")]
    Toolbar -- "setDataPoints / setScalingMode / setIsolatedOctant" --> Store
    PointCloud -- "setHoveredPoint / setPivot" --> Store
    CameraRig -- "setPivot" --> Store
    Store -- "dataPoints, gridSpace" --> PointCloud
    Store -- "gridSpace, axisLabels" --> Axes
    Store -- "gridSpace" --> CartesianGrid
    Store -- "isolatedOctant" --> OctantGizmo
    Store -- "hoveredPoint, axisLabels" --> HUD
```

### Two-layer rendering model

The application renders two separate layers stacked on top of each other: a flat 2D HTML/Tailwind layer (branding, HUD panels, legends, the toolbar) and a 3D `<Canvas>` layer beneath it (the navigable scene). These are two independent React trees — the HTML layer isn't a child of the Canvas, and neither has a direct reference to the other.

The 2D layer uses `pointer-events-none` so mouse clicks pass through it into the 3D scene, except where a specific HUD element (like the toolbar) opts back in. Because the two trees can't pass props to each other directly, they communicate exclusively through the shared Zustand store: a pointer event inside the Canvas (e.g. hovering a data point in `PointCloud.tsx`) updates the store, and the HTML layer (in `App.tsx`) reacts to that same store value to update the HUD — with neither component needing to know the other exists.

**Note on the toolbar's z-index:** React Three Fiber's `<Canvas>` wrapper renders after the HUD overlay in the DOM and establishes its own stacking context. Without an explicit `z-index` on the toolbar, the Canvas visually paints on top of it despite looking identical to the background — silently intercepting clicks meant for the toolbar. The toolbar is deliberately given a higher `z-index` than the HUD overlay to prevent this.

### Why Zustand for shared state

Given the two-layer model above, some mechanism is needed to synchronize state between the 3D scene and the 2D HUD. Zustand was chosen over React Context or Redux for a few reasons:

- No `<Provider>` wrapper required — any component calls the `useStore` hook directly
- Components subscribe to only the specific state slice they need (e.g. `state => state.pivot`), so a change to one field doesn't cause unrelated components to re-render
- Minimal boilerplate compared to Redux's actions/reducers/dispatch pattern, appropriate for the amount of shared state this application needs

**Exceptions to the store-driven pattern:** the pivot cross marker is driven imperatively by `CameraRig.tsx` via a ref, not by reading `pivot` from the store (see **Dynamic Pivot System** above). Similarly, the Isolate gizmo's camera-mirroring reads a plain mutable quaternion written every frame by `CameraRig` (`lib/cameraSync.ts`), deliberately outside Zustand, since a per-frame store write would re-render every subscriber 60 times a second.

### Why symmetric, signed grid ranges

Earlier, `computeGridSpace()` anchored each axis at its data minimum, adding a center reference line only for datasets that introduced negative values. The current model instead always returns a symmetric `[-M, +M]` range per axis, where `M` is derived from the farthest value on that axis (plus a margin, rounded outward) — so data-zero always sits at a known, consistent position (the box center for the full grid, a box edge or corner when an octant is isolated), regardless of the dataset's actual sign distribution. This removed the need for a separate "center axis" toggle and a "zero plane" mode switch — the zero-crossing reference is simply always drawn.

### Why a custom Cartesian grid instead of a built-in helper

`@react-three/drei` ships a generic `Grid` helper — a flat, infinite floor-plane grid intended for general 3D scene reference (e.g. a game editor's floor). It doesn't support bounded dimensions, per-axis symmetric ranges, octant-based partial ranges, or tick marks/axis labels tied to specific data ranges. `CartesianGrid.tsx` and `Axes.tsx` were built as custom components instead, giving full control over the plane position, wireframe box, and tick/label placement.

### Dynamic per-axis scaling

Each axis's display range is computed by `computeGridSpace()` in `src/lib/gridSpace.ts`, a pure function re-run whenever the active dataset, scaling mode, custom bounds, or isolated octant changes (see `useStore.ts`'s `gridSpaceFor()` helper, which centralizes every input this computation depends on so no dependency can be silently missed). `gridSpace.ts`'s output — `DISPLAY_RANGE`, `SCALE`, `CENTER`, `ZERO_RENDER`, and `toRenderSpace` — is the single source of truth shared by `CartesianGrid.tsx` (box/plane geometry), `Axes.tsx` (ticks/labels), and `PointCloud.tsx` (point positioning and octant filtering via `inOctant()`), so the three can never drift out of sync with each other.

---

## Application Structure

```text
orinoco/
├── docs/
│   ├── images/
│   │   ├── main.png
│   │   └── data_info.png
│   └── video/
│       └── orinoco-demo.mp4
│
├── sample-data/
│   ├── error-showcase.csv
│   │   └── One file exercising several row-level exclusions at once
│   └── error-cases/
│       └── One CSV per error code (csv-001…csv-004, clr-001…clr-050),
│           for manually confirming each rejection surfaces correctly
│
├── src/
│   ├── components/
│   │   ├── Axes.tsx
│   │   │   └── Bold coordinate axes through the origin, tick
│   │   │       marks/labels, and axis titles
│   │   │
│   │   ├── CartesianGrid.tsx
│   │   │   └── Horizontal grid plane at data-zero + full
│   │   │       12-edge wireframe box
│   │   │
│   │   ├── CameraRig.tsx
│   │   │   └── WASD + arrow/space/shift navigation, drag-panning,
│   │   │       zoom/pivot guardrails, and imperative per-frame
│   │   │       tracking of the pivot marker and camera-sync quaternion
│   │   │
│   │   ├── OctantGizmo.tsx
│   │   │   └── The Isolate page's rotating cube-of-cubes control
│   │   │
│   │   ├── IsolationTransition.tsx
│   │   │   └── Animates the affine transform between full-grid and
│   │   │       isolated-octant mappings
│   │   │
│   │   ├── PointCloud.tsx
│   │   │   └── Threat data rendering and interaction — reads the
│   │   │       active dataset and grid geometry from the store
│   │   │
│   │   └── Toolbar.tsx
│   │       └── Docked, resizable side panel: CSV loader, origin
│   │           reset, Data/Grid/Isolate/Console pages
│   │
│   ├── lib/
│   │   ├── gridSpace.ts
│   │   │   └── computeGridSpace() — derives symmetric plotting
│   │   │       bounds, scaling, and octant-isolated ranges
│   │   ├── cameraSync.ts
│   │   │   └── Mutable camera-orientation quaternion shared between
│   │   │       CameraRig and OctantGizmo, outside the store
│   │   ├── classColors.ts
│   │   │   └── Single source of truth for classification → color mapping
│   │   ├── config.ts
│   │   │   └── Typed loader + validator for config.json — the single
│   │   │       place deployment-level values are read from
│   │   ├── errorCodes.ts
│   │   │   └── Registry of every diagnostic code (CSV-xxx, CLR-xxx)
│   │   │       plus the AppError helpers that carry one into the UI
│   │   ├── parseCSV.ts
│   │   │   └── Auto-detecting CSV parser — classifies columns,
│   │   │       maps them to X/Y/Z/uid/class, validates and reports errors
│   │   └── parseColorsCSV.ts
│   │   │   └── Parses a colors.csv override file, mapping class names
│   │   │       to hex colors with flexible header matching
│   │   ├── colorValidation.ts
│   │   │   └── Cross-checks color overrides against the loaded
│   │   │       dataset's actual classes; flags unmatched overrides
│   │   └── truncateLabel.ts
│   │       └── 8-character display truncation for long axis/class
│   │           names, with separator-aware splitting
│   │
│   ├── store/
│   │   └── useStore.ts
│   │       └── Global visualization state: pivot, hoveredPoint,
│   │           hoveredAxis, dataPoints, gridSpace, axisLabels,
│   │           gridVisible, activeTool, hiddenClasses, numericFilters,
│   │           hiddenTickAxes, scalingMode, customBounds,
│   │           isolatedOctant, tickDensity, logEntries,
│   │           classColorOverrides
│   │
│   ├── types.ts
│   │   └── Shared DataPoint interface, used by the store, parser,
│   │       and grid math so the shape is defined exactly once
│   │
│   ├── App.tsx
│   │   └── Application shell, Canvas, HUD, and CSV-load orchestration
│   │
│   ├── main.tsx
│   │   └── React entry point
│   │
│   ├── vite-env.d.ts
│   │   └── Vite/TypeScript environment type declarations
│   │
│   └── index.css
│       └── Tailwind CSS configuration
│
├── vite.config.ts
└── package.json
```

---

# Interaction Flow

The application follows this interaction model:

```text
User Interaction
        |
        ↓
React Three Fiber Events
        |
        ↓
Zustand Global State
        |
        ↓
HUD Updates
```

Example — hovering a point:

1. User hovers over a threat node
2. R3F pointer event captures the interaction
3. Metadata updates the Zustand store
4. The HUD displays point information

Example — loading a CSV:

1. User clicks the toolbar's paperclip icon and selects a file
2. `parseCSV.ts` classifies columns and validates the shape
3. On success, `setDataPoints` replaces the dataset, clears any isolated octant, and recomputes grid geometry and axis labels atomically
4. The grid, axis labels, HUD panel, and rendered points all update to reflect the new dataset

Example — isolating an octant:

1. User clicks a cube on the Isolate page's gizmo
2. `setIsolatedOctant` recomputes `gridSpace` with that octant's one-sided ranges and resets the pivot to the origin
3. `IsolationTransition` animates the affine remap over 450ms
4. Points outside the octant are filtered from the render via `inOctant()`; ticks and axes rescale to the narrower range

---

# Tech Stack

## Framework & Build

### React 19 + TypeScript

Used for:

- Component architecture
- Type-safe application development
- UI state management

### Vite

Used for:

- Fast development workflow
- Optimized production builds

---

## 3D Visualization

### Three.js

WebGL-based 3D rendering engine.

### React Three Fiber (R3F)

Provides a React-based interface for managing Three.js scenes.

Used features:

- `<Canvas />` rendering environment
- `useFrame` animation loop
- Pointer interaction events
- 3D object components
- Scene and camera integration
- Instanced rendering (`InstancedMesh`) for the point cloud, scaling to 100k+ points as a single draw call
- Imperative refs (`pivotMarkerRef`) for per-frame object updates outside the store-driven pattern

### @react-three/drei

Provides reusable Three.js helpers:

- OrbitControls
- Billboard labels
- Text components

---

## State Management

### Zustand

Used for low-latency synchronization between:

- 3D interaction events
- Camera pivot state
- The active dataset and its derived grid geometry
- HUD metadata

Managed state:

- Current pivot coordinates
- Hovered point information
- Active dataset (`dataPoints`)
- Derived grid geometry for the active dataset (`gridSpace`)
- Axis labels for the active dataset (`axisLabels`)
- Grid visibility (`gridVisible`)
- Active navigation tool — orbit or pan (`activeTool`)
- Distinct class names present in the active dataset (`availableClasses`)
- Class visibility and per-axis numeric filters (`hiddenClasses`, `numericFilters`)
- Per-axis tick label visibility (`hiddenTickAxes`)
- Active axis-scaling mode and custom bounds (`scalingMode`, `customBounds`)
- Currently isolated octant, if any (`isolatedOctant`)
- Tick-density target (`tickDensity`)
- Session diagnostics log — every error/warning/info raised this session (`logEntries`)

---

## Data Parsing

### PapaParse

CSV parsing library used by `parseCSV.ts` to read uploaded files. Paired with `@types/papaparse` for TypeScript type coverage, since the library doesn't ship its own type declarations.

---

## Styling & Tooling

### Tailwind CSS v4

Used for:

- HUD overlays
- Toolbar and panel styling
- Interface components
- Responsive styling

### OxLint

Rust-based linter used for:

- Fast code analysis
- Correctness checks
- Development consistency

The project runs OxLint through the configured npm lint script:

```bash
npm run lint
```

### Lucide React

Icon library used for interface elements, including the toolbar's icon strip (paperclip, reset, pan/orbit toggle, Data/Grid/Isolate/Console page icons).

---

# Data Configuration

The application does not bundle a dataset. It opens on an empty grid and waits for the analyst to load a CSV. A deployer who wants a dataset loaded on open can point `data.sampleDataset` (in `config.json`) at a path or URL the browser can fetch; that file goes through the same `parseCSV → setDataPoints` pipeline a manual upload does, so there is no separate hardcoded-data code path either way.

Every loaded dataset, whether fetched at startup or picked from the toolbar, shares the same internal shape:

```json
{
  "uid": "C7mJzI2kJo1VmffDG6",
  "x": 13816,
  "y": 0.02753,
  "z": 84.084211,
  "className": "normal"
}
```

Column-to-axis mapping is produced by `parseCSV.ts`'s auto-detection — see **Dynamic Dataset Loading**.

Classification colors are defined in `src/lib/classColors.ts`, shared by both the point cloud rendering and the HUD legend so they can't drift out of sync. Any class value not present in this mapping (e.g. from a loaded CSV with new categories) gets a color generated deterministically from its name, rather than failing.

---

# Deployment Configuration

Most values that would otherwise be hardcoded — grid dimensions, point sizing, camera speeds and zoom limits, startup defaults, slider ranges, accepted CSV/color-file header names, and diagnostics log limits — live in a single `config.json` at the project root instead of scattered across component files.

- Vite inlines `config.json` at build time, so changes require a dev-server restart or rebuild to take effect
- The config's shape is validated at module load — a value that's the right type but a nonsensical setting (e.g. an inverted zoom range, a negative point count) throws a clear error immediately rather than surfacing later as a subtle rendering bug
- This is aimed at deployment-time tuning, not runtime user preference — the Toolbar's own sliders (point size, tick density) still control per-session values within whatever range `config.json` allows

---

# Installation & Setup

## Prerequisites

| Tool    | Version                          | Notes                                                                          |
| ------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Node.js | v22.12.0 or newer (v24.x tested) | Required by `@react-three/drei`'s `camera-controls` dependency; see note below |
| npm     | v10 or newer (bundled with Node) | Verify with `npm -v`                                                           |
| Git     | any recent version               | Required to clone the repo                                                     |

This project was developed and tested with **Node v24.13.1** and **npm 11.10.0**.

### Installing Node.js

- **Windows**: [Official installer](https://nodejs.org/) or [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **macOS**: [nvm](https://github.com/nvm-sh/nvm) (`brew install nvm`) or Homebrew (`brew install node`)
- **Linux**: [nvm](https://github.com/nvm-sh/nvm) or your distro's package manager

After installing, confirm your versions match the table above:

```bash
node -v
npm -v
```

## Clone Repository

The following commands are identical across PowerShell, Command Prompt, WSL/Git Bash, and macOS/Linux terminals.

```bash
git clone https://github.com/cwheelus/orinoco.git
cd orinoco
```

## Install Dependencies

```bash
npm install
```

## Start Development Server

```bash
npm run dev
```

By default this serves the app at [http://localhost:5173](http://localhost:5173) (Vite's default dev port). The app opens blank — load a CSV via the toolbar's paperclip icon to get started.

## Build for Production

```bash
npm run build
```

## Run Linter

```bash
npm run lint
```

## Run Tests

```bash
npm test
```

Runs the automated Vitest suite (118 tests covering CSV/color-file parsing, filters, truncation, the error-code guard, Console log-id behavior, grid geometry, and classification-color resolution). See [TESTING_GUIDE.md](TESTING_GUIDE.md) for setup notes, testing conventions, and a full breakdown of what is and isn't covered.

## Test Data

The application ships without a dataset. Supply a CSV through the toolbar's paperclip icon, or configure an optional startup dataset through `data.sampleDataset` in `config.json`.

Fixtures for manually exercising the loader's rejection paths are provided in `sample-data/`:

| File                 | Purpose                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `error-showcase.csv` | Several row-level exclusion causes in one file, for checking the Console's per-cause summary                                   |
| `error-cases/*.csv`  | One file per error code (`csv-001`…`csv-004`, `clr-001`…`clr-050`), for confirming each rejection surfaces with the right code |

Any CSV with at least two numeric columns and one text column will load; see [TESTING_GUIDE.md](TESTING_GUIDE.md) for the manual QA procedure these fixtures support.

## Key Dependency Versions

Pulled directly from [package.json](package.json)

| Package                | Version  |
| ---------------------- | -------- |
| react / react-dom      | ^19.2.7  |
| typescript             | ~6.0.2   |
| vite                   | ^8.1.1   |
| three                  | ^0.185.1 |
| @react-three/fiber     | ^9.6.1   |
| @react-three/drei      | ^10.7.7  |
| zustand                | ^5.0.14  |
| tailwindcss            | ^4.3.2   |
| papaparse              | ^5.5.4   |
| @types/papaparse (dev) | ^5.5.2   |
| lucide-react           | ^1.25.0  |
| oxlint (dev)           | ^1.71.0  |
| vitest (dev)           | ^4.1.10  |

---

# Future Enhancements

See the [Issues tab](https://github.com/cwheelus/orinoco/issues) for planned work and open feature requests.

- **Update README screenshots** — replace the placeholder `main.png` and `data_info.png` images with current captures reflecting the signed-grid and octant-isolation interface, along with newer features such as 2D camera lock and the Diagnostics Console.

---

# Current Development Status

Project Orinoco is a functional MVP demonstrating:

- Interactive 3D threat visualization with a symmetric, signed Cartesian grid
- Octant isolation with a camera-synced gizmo and animated transitions
- Three axis-scaling modes: auto-normalized, auto-real-scale, and custom bounds
- WASD camera navigation with dedicated arrow/space/shift pivot traversal, plus orbit and pan drag modes
- Navigation guardrails: zoom limits, pivot bounds, and stuck-key protection
- Dynamic pivot exploration with origin reset and lockstep marker tracking
- CSV-only dataset loading — nothing is bundled and the app opens blank, prompting for a file — with an auto-detecting parser and clear error handling for malformed or partially invalid files, plus an optional colors.csv override for classification colors
- A locked, flat top-down camera mode for 2D (Z-less) datasets, with orbit/tilt disabled and full arrow-key panning preserved
- A session diagnostics Console with stable, coded error/warning/info entries and per-row detail
- Deployment-level tuning via a validated `config.json` (grid, points, camera, defaults, sliders)
- A docked, resizable toolbar for data loading, pivot reset, dataset filtering, and grid/scaling/isolation controls
- Instanced point rendering with count-adaptive sizing for large datasets
- Real-time metadata inspection, labeled with the active dataset's real column names
- SOC-style analyst interface
- Semi-transparent point rendering, so overlapping or closely-clustered observations remain visually distinguishable instead of merging into a single shape
- An automated Vitest regression suite (118 tests) covering CSV/color-file parsing, numeric filters, display truncation, the error-code type guard, Console log-id behavior, grid geometry, and classification-color resolution — see [TESTING_GUIDE.md](TESTING_GUIDE.md)

---

# Project Team

©2026 Sentient Solutions

Developers:

- Mark Yosinao
- Daniel Merced

Advisors:

- Eric Lloyd
- BC Ko

Stakeholder:

- Charles Wheelus, Founder
  Sentient.solutions
