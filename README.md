# Project Orinoco // 3D Cyber Threat Intelligence Visualizer

A browser-native 3D visualization MVP built for Sentient Solutions. Project Orinoco enables security analysts to explore high-dimensional network data clusters through interactive 3D navigation, spatial analysis, and point inspection.

The application visualizes network features including **Entropy**, **Convolution**, and **WHT-scores** within a 3D Cartesian coordinate system. Analysts can navigate the environment, inspect individual data points, and dynamically adjust their exploration viewpoint through an interactive pivot system.

> Throughout this document, **Entropy**, **Convolution**, and **WHT-score** refer to the conceptual features being visualized. `in-entropy`, `in-conv`, and `in-WHT-score` refer to the corresponding JSON field names and axis mappings.

---

# Preview

## Application Demo

**Demo Videos:**
[Watch Orinoco MVP Walkthrough 7/8/2026](https://youtu.be/Gr2Yjx_JF_4)

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

The plotting volume is an open-face Cartesian box spanning -2 to 2 on each axis, built in `CartesianGrid.tsx`. Tick marks, numeric labels, and axis titles are rendered separately in `Axes.tsx`.

Data dimensions:

| Feature      | Axis |
| ------------ | ---- |
| in-entropy   | Y    |
| in-conv      | X    |
| in-WHT-score | Z    |

---

## Tactical Navigation

The visualization environment supports analyst-focused navigation.

| Input       | Action                         |
| ----------- | ------------------------------ |
| W           | Move toward current pivot      |
| S           | Move away from current pivot   |
| A           | Orbit left around pivot        |
| D           | Orbit right around pivot       |
| Mouse Drag  | Free camera rotation           |
| Mouse Hover | Inspect point metadata         |
| Mouse Click | Set selected node as new pivot |

---

## Dynamic Pivot System

Users can select any data node as an investigation reference point.

When a node is selected:

1. The global pivot coordinate updates
2. The camera navigation pivot updates to the selected location
3. The tactical reticle identifies the active pivot
4. Analysts can explore nearby data relationships

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

| Data Value | Display Label | Color     |
| ---------- | ------------- | --------- |
| `attack`   | Attack        | `#CC0000` |
| `normal`   | Normal        | `#00CC00` |
| `unknown`  | Unknown       | `#FFFFFF` |

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

The spec calls for a fixed -2 to 2 box with visible walls on specific sides only (an "open-face" box, per analyst feedback that a fully enclosed cube obscures the view), plus numbered ticks at 0.5 intervals synced to axis name labels. No configuration of the drei helper could produce this — so `CartesianGrid.tsx` and `Axes.tsx` were built as custom components instead, giving full control over bounds, open/closed faces, and tick/label placement.

The Cartesian plotting volume provides a normalized coordinate space for visualization. Individual datasets may undergo transformation into this plotting space before rendering.

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
│   │   │   └── Open-face Cartesian plotting volume (-2 to 2)
│   │   │
│   │   ├── CameraRig.tsx
│   │   │   └── WASD navigation and camera movement logic
│   │   │
│   │   └── PointCloud.tsx
│   │       └── Threat data rendering and interaction
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

The current MVP loads visualization data from a local JSON file. The rendering architecture intentionally separates the visualization engine from the data source so future datasets can be introduced with minimal changes.

The visualization expects each data point to contain a unique identifier, three-dimensional feature values, and a classification label.

Example schema:

```json
{
  "uid": "12341234",
  "in-entropy": 0.45,
  "in-conv": 0.72,
  "in-WHT-score": 0.31,
  "class": "attack"
}
```

Data mapping:

```text
in-entropy      → Y axis
in-conv         → X axis
in-WHT-score    → Z axis
class           → Visualization category
uid             → Point identifier displayed in the HUD
```

Current visualization categories:

| Data Value | Display Label | Color     |
| ---------- | ------------- | --------- |
| `attack`   | Attack        | `#CC0000` |
| `normal`   | Normal        | `#00CC00` |
| `unknown`  | Unknown       | `#FFFFFF` |

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

- Live threat data ingestion
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
- Cartesian spatial rendering
- WASD camera navigation
- Dynamic pivot exploration
- Real-time metadata inspection
- SOC-style analyst interface

---

# Project Team

©2026 Sentient Solutions

Developed by:

- Mark Yosinao
- Daniel Merced

Advisors:

- Eric Lloyd
- BC Ko