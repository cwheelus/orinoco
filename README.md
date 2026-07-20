# Project Orinoco // 3D Cyber Threat Intelligence Visualizer

Project Orinoco is a browser-native 3D visualization tool for exploring network telemetry. It projects selected traffic features into a three-dimensional Cartesian space, allowing analysts to inspect individual observations, navigate spatial relationships, and investigate clusters interactively.

The application visualizes network flow features within a 3D Cartesian coordinate system. Analysts can navigate the environment, inspect individual data points, and dynamically adjust their exploration viewpoint through an interactive pivot system. Camera movement is always relative to the active pivot.

---

# Preview

## Application Demo

**Demo Videos:**
[Watch Orinoco MVP Walkthrough 7/8/2026](https://youtu.be/Gr2Yjx_JF_4)
[Watch Orinoco MVP Walkthrough 7/20/2026](https://youtu.be/_KvzO14yMGE)

Example walkthrough:

- Navigate the 3D environment using keyboard and mouse controls
- Hover over threat nodes to inspect metadata
- Select nodes to change the active pivot location
- Explore surrounding data points from different perspectives

---

## Screenshots

### Main Visualization View

![Main Visualization](docs/images/main.png)

### Point Inspection HUD

![Point Inspection HUD](docs/images/data_info.png)

---

# Key Features

## 3D Cartesian Plot Visualization

Project Orinoco renders high-dimensional network features in an interactive WebGL environment using Three.js and React Three Fiber.

The plotting volume is an open-face Cartesian box, built in `CartesianGrid.tsx`. Tick marks, numeric labels, and axis titles are rendered separately in `Axes.tsx`. Each axis is independently scaled to the dataset's numeric range, rather than assuming a fixed bound — tick labels always reflect real data-space values.

Data dimensions:

| Feature    | Axis |
| ---------- | ---- |
| invel-pps  | Y    |
| orig-bytes | X    |
| invel-bpp  | Z    |

---

## Tactical Navigation

The visualization environment supports analyst-focused navigation.

| Input         | Action                         |
| ------------- | ------------------------------ |
| W             | Move toward current pivot      |
| S             | Move away from current pivot   |
| A             | Orbit left around pivot        |
| D             | Orbit right around pivot       |
| Mouse Drag    | Free camera rotation           |
| Mouse Hover   | Inspect point metadata         |
| Mouse Click   | Set selected node as new pivot |
| Reset Control | Return pivot to origin         |

---

## Dynamic Pivot System

Users can select any data node as an investigation reference point.

When a node is selected:

1. The global pivot coordinate updates
2. The camera navigation pivot updates to the selected location
3. The tactical reticle identifies the active pivot
4. Analysts can explore nearby data relationships

Users can reset the investigation pivot to the origin coordinate through the HUD control, providing a consistent baseline for spatial exploration.

---

## Interactive Point Inspection

Interactive 3D events provide metadata inspection through the Heads-Up Display (HUD).

Displayed information includes:

- UID
- Classification
- XYZ coordinates
- Feature values

---

## SOC-Inspired Interface

The interface uses a security operations center inspired design with high-contrast visualization and a glass-morphism HUD.

Current classification visualization:

| Data Value | Color     |
| ---------- | --------- |
| `normal`   | `#dddddd` |
| `nss`      | `#dd0000` |
| `qc`       | `#00dd00` |
| `zt`       | `#0000dd` |

---

# Architecture

Project Orinoco separates rendering, application state, and interface responsibilities.

## Design Philosophy

Project Orinoco follows a separation-of-concerns architecture:

- React manages application structure and UI
- React Three Fiber manages 3D visualization
- Zustand manages shared interaction state
- Data sources remain independent from rendering logic

This architecture allows the visualization engine to evolve as new threat datasets become available.

### Two-layer rendering model

The application renders two separate layers stacked on top of each other: a flat 2D HTML/Tailwind layer (branding, HUD panels, legends) and a 3D `<Canvas>` layer beneath it (the navigable scene). These are two independent React trees — the HTML layer isn't a child of the Canvas, and neither has a direct reference to the other.

The 2D layer uses `pointer-events-none` so mouse clicks pass through it into the 3D scene, except where a specific HUD element opts back in. Because the two trees can't pass props to each other directly, they communicate exclusively through the shared Zustand store: a pointer event inside the Canvas (e.g. hovering a data point in `PointCloud.tsx`) updates the store, and the HTML layer (in `App.tsx`) reacts to that same store value to update the HUD — with neither component needing to know the other exists.

### Why Zustand for shared state

Given the two-layer model above, some mechanism is needed to synchronize state between the 3D scene and the 2D HUD. Zustand was chosen over React Context or Redux for a few reasons:

- No `<Provider>` wrapper required — any component calls the `useStore` hook directly
- Components subscribe to only the specific state slice they need (e.g. `state => state.pivot`), so a change to one field doesn't cause unrelated components to re-render
- Minimal boilerplate compared to Redux's actions/reducers/dispatch pattern, appropriate for the relatively small amount of shared state this application currently needs (`pivot`, `hoveredPoint`)

### Why a custom Cartesian grid instead of a built-in helper

`@react-three/drei` ships a generic `Grid` helper — a flat, infinite floor-plane grid intended for general 3D scene reference (e.g. a game editor's floor). It doesn't support bounded dimensions, selectable wall faces, or tick marks/axis labels tied to specific data ranges.

The spec calls for a box with visible walls on specific sides only (an "open-face" box, per analyst feedback that a fully enclosed cube obscures the view), plus numbered ticks synced to axis name labels. No configuration of the drei helper could produce this — so `CartesianGrid.tsx` and `Axes.tsx` were built as custom components instead, giving full control over bounds, open/closed faces, and tick/label placement.

### Dynamic per-axis scaling

Each axis scales independently based on the loaded dataset's actual range (`src/lib/gridSpace.ts`), rather than assuming a fixed bound. This was chosen because the real dataset's three columns (byte counts, packet rates, bytes-per-packet) live on wildly different magnitudes — a single shared scale factor compressed two of the three axes into a nearly flat sliver. `gridSpace.ts` is the single source of truth for these bounds, shared by `CartesianGrid.tsx` (box geometry), `Axes.tsx` (ticks/labels), and `PointCloud.tsx` (point positioning), so the three can never drift out of sync with each other.

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
├── src/
│   ├── components/
│   │   ├── Axes.tsx
│   │   │   └── Tick marks, numeric labels, and axis titles
│   │   │
│   │   ├── CartesianGrid.tsx
│   │   │   └── Open-face Cartesian plotting volume
│   │   │
│   │   ├── CameraRig.tsx
│   │   │   └── WASD navigation and camera movement logic
│   │   │
│   │   └── PointCloud.tsx
│   │       └── Threat data rendering and interaction
│   │
│   ├── lib/
│   │   ├── gridSpace.ts
│   │   │   └── Single source of truth for plotting bounds and per-axis scaling
│   │   └── classColors.ts
│   │       └── Single source of truth for classification → color mapping
│   │
│   ├── store/
│   │   └── useStore.ts
│   │       └── Global visualization state
│   │
│   ├── data.json
│   │   └── Local threat dataset
│   │
│   ├── App.tsx
│   │   └── Application shell, Canvas, and HUD
│   │
│   ├── main.tsx
│   │   └── React entry point
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

Example:

1. User hovers over a threat node
2. R3F pointer event captures the interaction
3. Metadata updates the Zustand store
4. The HUD displays point information

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
- HUD metadata

Managed state:

- Current pivot coordinates
- Hovered point information

---

## Styling & Tooling

### Tailwind CSS v4

Used for:

- HUD overlays
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

Icon library used for interface elements.

---

# Data Configuration

The current MVP loads visualization data from a local JSON file (`src/data.json`), sourced from Sentient Solutions' `flow-viz-sample1.csv`. The JSON file is an intermediate development format derived from the original CSV dataset.

The visualization expects each data point to contain a unique identifier, three-dimensional feature values, and a classification label.

Example schema:

```json
{
  "uid": "C7mJzI2kJo1VmffDG6",
  "x": 13816,
  "y": 0.02753,
  "z": 84.084211,
  "className": "normal"
}
```

Data mapping:

```text
x (orig_bytes)  → X axis
y (invel_pps)   → Y axis
z (invel_bpp)   → Z axis
className       → Visualization category
uid             → Point identifier displayed in the HUD
```

Current visualization categories:

| Data Value | Color     |
| ---------- | --------- |
| `normal`   | `#dddddd` |
| `nss`      | `#dd0000` |
| `qc`       | `#00dd00` |
| `zt`       | `#0000dd` |

Classification colors are sourced from Sentient Solutions' `colors.csv` and defined in `src/lib/classColors.ts`, shared by both the point cloud rendering and the HUD legend so they can't drift out of sync.

The rendering architecture separates the visualization layer from the data source, allowing future datasets to be introduced through a data transformation layer without requiring changes to the 3D rendering components.

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

By default this serves the app at [http://localhost:5173](http://localhost:5173) (Vite's default dev port).

## Build for Production

```bash
npm run build
```

## Run Linter

```bash
npm run lint
```

## Key Dependency Versions

Pulled directly from [package.json](package.json)

| Package            | Version  |
| ------------------ | -------- |
| react / react-dom  | ^19.2.7  |
| typescript         | ~6.0.2   |
| vite               | ^8.1.1   |
| three              | ^0.185.1 |
| @react-three/fiber | ^9.6.1   |
| @react-three/drei  | ^10.7.7  |
| zustand            | ^5.0.14  |
| tailwindcss        | ^4.3.2   |
| papaparse          | ^5.5.4   |
| oxlint (dev)       | ^1.71.0  |

---

# Future Enhancements

Potential future improvements:

- Live threat data ingestion (CSV loading system)
- Camera navigation refinements
- Grid line toggle
- Camera guardrails
- Backend API integration
- Advanced filtering and search
- Additional classification categories
- Large dataset optimization using InstancedMesh
- Analyst investigation bookmarks
- Dataset comparison workflows

---

# Current Development Status

Project Orinoco is a functional MVP demonstrating:

- Interactive 3D threat visualization
- Cartesian spatial rendering with dynamic per-axis scaling
- WASD camera navigation
- Dynamic pivot exploration with origin reset
- Real-time metadata inspection
- SOC-style analyst interface

---

# Project Team

©2026 Sentient Solutions

Developers:

- Mark Yosinao
- Daniel Merced

Advisors:

- Eric Lloyd
- BC Ko
