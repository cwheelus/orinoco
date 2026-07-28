# Orinoco User Guide

**Project Orinoco — 3D Cyber Threat Intelligence Visualizer**

*Version 1.0 | Last updated: July 2026*

---

## Table of Contents

1. [What Is Orinoco?](#1-what-is-orinoco)
2. [Prerequisites](#2-prerequisites)
3. [Quick Start](#3-quick-start)
4. [Navigating the 3D Scene](#4-navigating-the-3d-scene)
5. [Inspecting Data Points](#5-inspecting-data-points)
6. [Using the Toolbar](#6-using-the-toolbar)
   - [Data Page](#data-page)
   - [Grid Page](#grid-page)
7. [Loading Your Own CSV Dataset](#7-loading-your-own-csv-dataset)
8. [Troubleshooting](#8-troubleshooting)
9. [Keyboard & Mouse Reference](#9-keyboard--mouse-reference)

---

## 1. What Is Orinoco?

Orinoco is a browser-native 3D visualization tool for exploring network telemetry. It projects selected traffic features into a three-dimensional Cartesian space, allowing security analysts to:

- Inspect individual observations and their metadata
- Navigate spatial relationships between data points
- Investigate clusters interactively
- Load custom datasets directly in the browser

Orinoco runs entirely client-side — no server, no database, no cloud dependency. All data processing happens in-memory in your browser.

### Who This Is For

- Security Operations Center (SOC) analysts
- Threat intelligence researchers
- Data scientists exploring high-dimensional network features

---

## 2. Prerequisites

To run Orinoco from source, you need:

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | v22.12.0 or newer | Required by the 3D camera-controls dependency |
| **npm** | v10 or newer | Bundled with Node.js |
| **Git** | Any recent version | To clone the repository |
| **Web Browser** | Chrome, Firefox, Edge, or Safari | WebGL support required |

Verify your versions:

```bash
node -v
npm -v
```

> **Note:** Orinoco is built with **React 19**, **TypeScript**, **Vite**, and **Three.js** (via React Three Fiber). You do not need to install these individually — `npm install` handles all dependencies.

---

## 3. Quick Start

### 3.1 Clone and Install

```bash
git clone https://github.com/cwheelus/orinoco.git
cd orinoco
npm install
```

### 3.2 Start the Development Server

```bash
npm run dev
```

By default, the application serves at `http://localhost:5173`.

### 3.3 Load the Sample Dataset

1. Click the **paperclip icon** in the right-side toolbar.
2. Select `flow-viz-sample1.csv` (or any compatible CSV from the `sample-data/` or `test-data/` folders).
3. The grid, axis labels, and data points will update automatically.

### 3.4 First Look

When the dataset loads, you will see:

- **A 3D Cartesian grid** showing the bounds of your data
- **Colored data points** representing individual network flows
- **Axis labels** showing the actual column names from your CSV
- **A HUD panel** in the top-left showing the currently hovered point's metadata
- **A toolbar** docked to the right edge for data and display controls

---

## 4. Navigating the 3D Scene

### 4.1 Camera Movement

Camera movement is always relative to the **active pivot point** — a reference coordinate in 3D space that starts at the origin `(0, 0, 0)`.

| Input | Action |
|-------|--------|
| **W** | Move camera toward the pivot |
| **S** | Move camera away from the pivot |
| **A** | Orbit camera left around the pivot |
| **D** | Orbit camera right around the pivot |

### 4.2 Pivot Movement

Move the pivot point itself to explore different regions of the data:

| Input | Action |
|-------|--------|
| **← / →** (Arrow Left / Right) | Move pivot along the X axis |
| **↑ / ↓** (Arrow Up / Down) | Move pivot along the Z axis |
| **Space** | Raise pivot along the Y axis |
| **Shift** | Lower pivot along the Y axis |

When the pivot changes, the camera translates by the same offset, preserving your viewing angle. The pivot is marked by a **six-armed cross reticle** in the scene.

### 4.3 Mouse Controls

| Input | Action |
|-------|--------|
| **Mouse Drag** | Rotate camera around pivot (Orbit mode) or translate view (Pan mode) |
| **Mouse Hover** | Inspect point metadata in the HUD |
| **Mouse Click** | Set clicked point as the new pivot |

Toggle between **Orbit** and **Pan** modes using the **hand / pointer icon** in the toolbar.

### 4.4 Reset

Click the **reset icon** (circular arrow) in the toolbar to return the pivot to the origin `(0, 0, 0)`.

---

## 5. Inspecting Data Points

### 5.1 Hover to Inspect

Move your cursor over any data point to see its metadata in the **Point Analysis HUD** (top-left panel):

| Field | Description |
|-------|-------------|
| **UID** | Unique identifier for the network flow |
| **Classification** | Threat category (e.g., `normal`, `nss`, `qc`, `zt`) |
| **X, Y, Z** | Coordinates in 3D space |
| **Feature Values** | Raw values labeled with the actual column names from your dataset |

### 5.2 Click to Pivot

Click any data point to set it as the new investigation pivot. The camera will shift so the selected point remains at the same screen position, letting you explore its surrounding neighborhood from the same viewing angle.

### 5.3 Class Colors

Points are colored by their classification. The default color scheme:

| Class | Color | Hex |
|-------|-------|-----|
| `normal` | Light Gray | `#dddddd` |
| `nss` | Red | `#dd0000` |
| `qc` | Green | `#00dd00` |
| `zt` | Blue | `#0000dd` |

Unrecognized classes from custom CSVs will use a default fallback color.

---

## 6. Using the Toolbar

The toolbar is a Blender-style docked panel on the right edge of the screen. It has two parts:

- **Icon strip** — fixed buttons for common actions
- **Content pane** — expandable panel for detailed controls

Drag the border between the icon strip and the viewport to resize the content pane open or closed.

### 6.1 Icon Strip

| Icon | Action |
|------|--------|
| 📎 Paperclip | Open file picker to load a CSV |
| 🔄 Reset | Return pivot to origin |
| 👁 Eye / Eye-Off | Toggle Cartesian grid box visibility (axis labels remain) |
| ✋ Hand / Pointer | Switch mouse drag between Orbit (rotate) and Pan (translate) |
| 📊 Data | Open Data page (filters, point sizing) |
| ⊞ Grid | Open Grid page (axis display, grid modes) |

### Data Page

The Data page controls which points are visible and how they appear.

#### Class Visibility Filtering

- Each classification category appears as a toggle with its color swatch.
- Uncheck a class to hide all points of that category from the render.
- Hidden points are excluded from the draw call — no reallocation, instant toggle.

#### Per-Axis Numeric Filters

Filter points by value range on any axis:

1. Select an axis (X, Y, or Z).
2. Choose an operator: `>`, `≥`, `<`, `≤`, `=`, or `between`.
3. Enter one or two numeric values.
4. Only points matching the filter criteria remain visible.

> **Tip:** Combine class filters and numeric filters to isolate specific threat clusters.

#### Point Size Scaling

- **Auto-size:** Point size adjusts automatically based on dataset density. Denser datasets get smaller points so they don't visually merge.
- **Manual multiplier:** Use the slider to scale all points up or down.
- **Reset:** One-click return to automatic sizing.

### Grid Page

The Grid page controls how the reference grid and axes are displayed.

#### Per-Axis Tick Label Visibility

Toggle tick marks and numeric labels independently for each axis:

- **X axis ticks**
- **Y axis ticks**
- **Z axis ticks**

Hiding ticks declutters the view without removing the axis line itself.

#### Center Y Axis

An experimental **Desmos-style vertical axis** running through the center of the floor plane (rather than the corner edge of the box). Toggling this shows/hides:

- The center axis line
- Its tick marks
- Its axis title

Wall-edge Y references remain visible independently.

#### Grid Modes

| Mode | Description |
|------|-------------|
| **Standard** | Floor-anchored grid. The plotting volume sits on a flat plane at the minimum Y value. |
| **Zero Plane** | Adds a horizontal reference plane at data-value `0`. Mixed-sign datasets visibly straddle this plane. On all-positive datasets, the plane is suppressed since the floor already sits at zero. |

---

## 7. Loading Your Own CSV Dataset

You are not limited to the bundled sample data. Any CSV matching the expected shape can be loaded directly in-browser.

### 7.1 Expected Format

Your CSV should have:

- **Exactly 3 numeric columns** — mapped to X, Y, Z axes (in the order they appear in the header)
- **At least 1 text column** — the column with the highest ratio of unique values becomes the **UID**; the next text column becomes the **Classification**
- **A header row** — column names are used for axis labels and HUD display

### 7.2 Example

```csv
uid,class,orig_bytes,invel_pps,invel_bpp
C7mJzI2kJo1VmffDG6,normal,13816,0.027529692,84.08421053
C1zHsL3Lm3CzJprVja,nss,9396,0.039653967,84.05714286
CenB4K3qGMIMOfa2Z7,qc,142,0.387946954,71
```

In this example:
- `orig_bytes` → X axis
- `invel_pps` → Y axis
- `invel_bpp` → Z axis
- `uid` → Point identifier
- `class` → Classification (color)

### 7.3 Loading Steps

1. Click the **paperclip icon** in the toolbar.
2. Select your CSV file.
3. The parser auto-detects column types and validates the shape.
4. On success, the grid scale, axis labels, HUD labels, and rendered points all update together.

### 7.4 Error Handling

If the file fails to load, you will see a specific error message:

| Error | Cause |
|-------|-------|
| Empty file | The file has no header row or no data rows |
| Wrong number of numeric columns | The CSV does not have exactly 3 numeric columns (found more or fewer) |
| No text/label columns found | The CSV lacks text columns for UID and Classification |
| No valid data rows | Every row had missing or invalid numeric values; nothing could be rendered |
| File read error | The browser could not read the file (corrupted, unreadable, or access denied) |

> **Partial load banner:** If your CSV loads but some rows are skipped due to missing or invalid numeric values, a red banner appears showing which row numbers were excluded (1-indexed, counting the header row as row 1). The valid rows still render — you do not need to reload the file. Check the source rows for blank cells, non-numeric values in numeric columns, or malformed entries.

> **Note:** Column order determines axis assignment. There is currently no manual override UI — ensure your CSV columns are ordered X, Y, Z, UID, Class (or similar) before loading.

### 7.5 Known Limitations

- Only the first two text columns are used (UID and Classification). Additional text columns are ignored.
- Datasets are held in memory only — reloading the page returns to the bundled default dataset.
- Column assignment is determined by file order, not by user selection.
- Rows with invalid or missing numeric values are skipped during load rather than causing the entire file to fail.

---

## 8. Troubleshooting

### I loaded a CSV but don't see any points

1. Check the **Data page** in the toolbar — a class filter or numeric filter may be hiding all points.
2. Check the **Grid page** — ensure the grid itself is visible (the eye toggle does not affect points).
3. Verify your CSV loaded without errors. Check the browser console for parse messages.

### The camera is lost / I can't see the data

1. Click the **reset button** in the toolbar to return to the origin.
2. Press **S** a few times to zoom out and reorient.
3. If the pivot was moved far from the data, reset and use **W** to zoom back in.

### The grid disappeared

- Click the **eye icon** in the toolbar to toggle grid visibility. Axis labels remain visible even when the grid box is hidden.

### Points are too small or too large

- Open the **Data page** in the toolbar.
- Adjust the **Point Size** slider.
- Click **Reset** to return to automatic density-based sizing.

### Axis labels show wrong names

- Axis labels are drawn from your CSV's header row.
- If labels don't match expectations, verify your CSV columns are in the correct order before loading.

### Camera feels slightly off after mixing keyboard and mouse movement

- This is a known interaction between the keyboard navigation system (WASD/orbit) and the mouse-drag orbit system. Both control the camera independently and can drift out of sync when used together in the same session.
- **Fix:** Click the **Reset** button in the toolbar to re-center the pivot and restore camera alignment.
- Tracked in GitHub issues [#5](https://github.com/cwheelus/orinoco/issues/5) and [#7](https://github.com/cwheelus/orinoco/issues/7).

### Performance is slow with a large dataset

- Orinoco uses **instanced mesh rendering** and has been tested with 10,000+ points.
- If performance degrades:
  - Use **class filters** to hide categories you don't need
  - Use **numeric filters** to reduce the visible point count
  - Ensure your browser's hardware acceleration is enabled

---

## 9. Keyboard & Mouse Reference

### Keyboard

| Key | Action |
|-----|--------|
| **W** | Move camera toward pivot |
| **S** | Move camera away from pivot |
| **A** | Orbit camera left around pivot |
| **D** | Orbit camera right around pivot |
| **←** (Arrow Left) | Move pivot along X axis (negative) |
| **→** (Arrow Right) | Move pivot along X axis (positive) |
| **↑** (Arrow Up) | Move pivot along Z axis (negative) |
| **↓** (Arrow Down) | Move pivot along Z axis (positive) |
| **Space** | Raise pivot along Y axis |
| **Shift** | Lower pivot along Y axis |

### Mouse

| Action | Effect |
|--------|--------|
| **Hover** | Inspect point metadata in HUD |
| **Click** | Set clicked point as new pivot |
| **Drag (Orbit mode)** | Rotate camera around pivot |
| **Drag (Pan mode)** | Translate view |

### Toolbar Shortcuts

| Icon | Click Action |
|------|--------------|
| 📎 Paperclip | Load CSV file |
| 🔄 Reset | Return pivot to origin |
| 👁 Eye | Toggle grid visibility |
| ✋ Hand / Pointer | Toggle Orbit vs Pan mode |
| 📊 Data | Open Data filters page |
| ⊞ Grid | Open Grid display page |

---

## Support & Feedback

- **Repository:** [github.com/cwheelus/orinoco](https://github.com/cwheelus/orinoco)
- **Issues:** Report bugs and request features via the GitHub Issues tab
- **Demo Videos:** See the repository README for walkthrough recordings

---

*© 2026 Sentient Solutions*
