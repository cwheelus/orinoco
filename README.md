# Project Orinoco // 3D Cyber Threat Intelligence Visualizer

A browser-native 3D visualization MVP built for Sentient Solutions. Project Orinoco enables security analysts to explore high-dimensional network data clusters through interactive 3D navigation, spatial analysis, and point inspection.

The application visualizes network features including **Entropy**, **Convolution**, and **WHT-scores** within a 3D Cartesian coordinate system. Analysts can navigate the environment, inspect individual data points, and dynamically adjust their exploration viewpoint through an interactive pivot system.

---

# 🎥 Preview

## Application Demo

▶️ **Demo Videos:** 
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

# 🚀 Key Features

## 3D Cartesian Plot Visualization

Project Orinoco renders high-dimensional network features in an interactive WebGL environment using Three.js and React Three Fiber.

Data dimensions:

| Feature      | Axis |
| ------------ | ---- |
| in-entropy   | X    |
| in-conv      | Y    |
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
2. The camera target changes to the selected location
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

# 🏗️ Architecture

Project Orinoco separates rendering, application state, and interface responsibilities.

## Design Philosophy

Project Orinoco follows a separation-of-concerns architecture:

- React manages application structure and UI
- React Three Fiber manages 3D visualization
- Zustand manages shared interaction state
- Data sources remain independent from rendering logic

This architecture allows the visualization engine to evolve as new threat datasets become available.

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
│   │   │   └── 3D axis labels and spatial references
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

# 🔄 Interaction Flow

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

# 🛠️ Tech Stack

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
- Grid helpers
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

# 📊 Data Configuration

The MVP currently loads visualization data from a local JSON source.

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
in-entropy      → X axis
in-conv         → Y axis
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

# 📥 Installation & Setup

## Prerequisites

| Tool    | Version                                | Notes                                          |
| ------- | ---------------------------------------- | ------------------------------------------------ |
| Node.js | v22.12.0 or newer (v24.x tested)         | Required by `@react-three/drei`'s `camera-controls` dependency; see note below |
| npm     | v10 or newer (bundled with Node)         | Verify with `npm -v`                            |
| Git     | any recent version                       | Required to clone the repo                      |

This project was developed and tested with **Node v24.13.1** and **npm 11.10.0**.

> **Why 22.12+ and not just "20+":** the toolchain (Vite, oxlint, `@vitejs/plugin-react`) supports `^20.19.0 || >=22.12.0`, but `camera-controls` — a direct dependency of `@react-three/drei` — requires `>=22.0.0`. Combined, the only Node line that satisfies every dependency is **22.12.0 or later**. Node 20.x (even 20.19+) and Node 21.x are not guaranteed to work.

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

| Package                   | Version   |
| -------------------------- | --------- |
| react / react-dom          | ^19.2.7   |
| typescript                 | ~6.0.2    |
| vite                       | ^8.1.1    |
| three                      | ^0.185.1  |
| @react-three/fiber          | ^9.6.1    |
| @react-three/drei           | ^10.7.7   |
| zustand                    | ^5.0.14   |
| tailwindcss                | ^4.3.2    |
| papaparse                  | ^5.5.4    |
| oxlint (dev)                | ^1.71.0   |

---

# 🔮 Future Enhancements

Potential future improvements:

- Live threat data ingestion
- Backend API integration
- Advanced filtering and search
- Additional classification categories
- Large dataset optimization using InstancedMesh
- Analyst investigation bookmarks
- Dataset comparison workflows

---

# ✅ Current Development Status

Project Orinoco is a functional MVP demonstrating:

- Interactive 3D threat visualization
- Cartesian spatial rendering
- WASD camera navigation
- Dynamic pivot exploration
- Real-time metadata inspection
- SOC-style analyst interface

---

# 👥 Project Team

©2026 Sentient Solutions

Developed by:

- Mark Yosinao
- Daniel Merced

Advisors:

- Eric Lloyd
- BC Ko
