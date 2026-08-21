# Orinoco User Guide

**Project Orinoco — 3D Cyber Threat Intelligence Visualizer**

_Last updated: August 2026_

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
   - [Isolate Page](#isolate-page)
7. [Loading Your Own CSV Dataset](#7-loading-your-own-csv-dataset)
   - [Loading Custom Classification Colors](#77-loading-custom-classification-colors)
8. [Troubleshooting](#8-troubleshooting)
9. [Keyboard & Mouse Reference](#9-keyboard--mouse-reference)

---

## 1. What Is Orinoco?

Orinoco is a browser-native 3D visualization tool for exploring network telemetry. It projects selected traffic features into a three-dimensional Cartesian space, allowing security analysts to:

- Inspect individual observations and their metadata
- Navigate spatial relationships between data points
- Investigate clusters interactively
- Isolate specific spatial regions (octants) for focused analysis
- Load custom datasets directly in the browser

Orinoco runs entirely client-side — no server, no database, no cloud dependency. All data processing happens in-memory in your browser.

### Who This Is For

- Security Operations Center (SOC) analysts
- Threat intelligence researchers
- Data scientists exploring high-dimensional network features

---

## 2. Prerequisites

To run Orinoco from source, you need:

| Tool            | Version                          | Notes                                         |
| --------------- | -------------------------------- | --------------------------------------------- |
| **Node.js**     | v22.12.0 or newer                | Required by the 3D camera-controls dependency |
| **npm**         | v10 or newer                     | Bundled with Node.js                          |
| **Git**         | Any recent version               | To clone the repository                       |
| **Web Browser** | Chrome, Firefox, Edge, or Safari | WebGL support required                        |

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

### 3.3 First Look

On launch, Orinoco opens with no dataset loaded. You will see:

- **A centered prompt** directing you to the paperclip icon in the toolbar to load a CSV
- **A neutral 3D Cartesian grid** with placeholder X/Y/Z axis labels
- **Three coordinate axes** running through the origin with arrowheads
- **A horizontal grid plane** at data-value zero
- **A faint wireframe box** outlining the plotting volume
- **A toolbar** docked to the right edge for data and display controls

Once you load a CSV (see [Section 7](#7-loading-your-own-csv-dataset)), the grid rescales to your data's actual range, axis labels update to your column names, and:

- **Colored data points** appear, representing individual network flows
- **A HUD panel** in the top-left shows metadata for whichever point you're hovering

![Orinoco boot state with symmetric grid and Grid page open](docs/images/main.jpg)

---

## 4. Navigating the 3D Scene

### 4.1 Camera Movement

Camera movement is always relative to the **active pivot point** — a reference coordinate in 3D space that starts at the origin `(0, 0, 0)`.

| Input | Action                              |
| ----- | ----------------------------------- |
| **W** | Move camera toward the pivot        |
| **S** | Move camera away from the pivot     |
| **A** | Orbit camera left around the pivot  |
| **D** | Orbit camera right around the pivot |

### 4.2 Pivot Movement

Move the pivot point itself to explore different regions of the data:

| Input                          | Action                       |
| ------------------------------ | ---------------------------- |
| **← / →** (Arrow Left / Right) | Move pivot along the X axis  |
| **↑ / ↓** (Arrow Up / Down)    | Move pivot along the Z axis  |
| **Space**                      | Raise pivot along the Y axis |
| **Shift**                      | Lower pivot along the Y axis |

When the pivot changes, the camera translates by the same offset, preserving your viewing angle. The pivot is marked by a **six-armed cross reticle** at the origin.

### 4.3 Mouse Controls

| Input           | Action                                                               |
| --------------- | -------------------------------------------------------------------- |
| **Mouse Drag**  | Rotate camera around pivot (Orbit mode) or translate view (Pan mode) |
| **Mouse Hover** | Inspect point metadata in the HUD                                    |
| **Mouse Click** | Set clicked point as the new pivot                                   |

Toggle between **Orbit** and **Pan** modes using the **hand / pointer icon** in the toolbar.

### 4.4 Reset

Click the **reset icon** (circular arrow) in the toolbar to return the pivot to the origin `(0, 0, 0)`.

### 4.5 Navigation Guardrails

Orinoco enforces soft limits to prevent losing the camera:

- **Zoom limits:** The camera cannot move closer than **0.15 units** or farther than **18 units** from the pivot
- **Pivot bounds:** The pivot cannot be moved more than **50% beyond the grid walls** (prevents wandering into empty space)
- **Stuck-key protection:** Taking screenshots with OS shortcuts (e.g., macOS Cmd+Shift+4) automatically releases all held keys

---

## 5. Inspecting Data Points

### 5.1 Hover to Inspect

Move your cursor over any data point to see its metadata in the **Point Analysis HUD** (top-left panel):

| Field              | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| **UID**            | Unique identifier for the network flow                            |
| **Classification** | Threat category (e.g., `normal`, `nss`, `qc`, `zt`)               |
| **X, Y, Z**        | Coordinates in 3D space                                           |
| **Feature Values** | Raw values labeled with the actual column names from your dataset |

### 5.2 Click to Pivot

Click any data point to set it as the new investigation pivot. The camera will shift so the selected point remains at the same screen position, letting you explore its surrounding neighborhood from the same viewing angle.

### 5.3 Class Colors

Points are colored by their classification:

| Class    | Color      | Hex       |
| -------- | ---------- | --------- |
| `normal` | Light Gray | `#dddddd` |
| `nss`    | Red        | `#dd0000` |
| `qc`     | Green      | `#00dd00` |
| `zt`     | Blue       | `#0000dd` |

Any classification not in the table above gets a color generated automatically from its name. The same class name always produces the same color, every time you load it — so a custom classification stays visually consistent across sessions and datasets, even though it's not one of the four built-in colors.

---

## 6. Using the Toolbar

The toolbar is a Blender-style docked panel on the right edge of the screen. It has two parts:

- **Icon strip** — fixed buttons for common actions and page navigation
- **Content pane** — expandable panel for detailed controls

Drag the border between the icon strip and the viewport to resize the content pane open or closed.

### 6.1 Icon Strip

| Icon               | Action                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 🌙 / ☀️ Moon / Sun | Toggle between dark mode and light mode                                                                                    |
| 📎 Paperclip       | Open file picker to load a CSV                                                                                             |
| 🎨 Palette         | Open file picker to load a `colors.csv` classification color override (see **7.7 Loading Custom Classification Colors**)   |
| 🔄 Reset           | Return pivot to origin                                                                                                     |
| ✋ Hand / Pointer  | Switch mouse drag between Orbit (rotate) and Pan (translate) — icon swaps to reflect the active mode                       |
| 🗄️ Data            | Open Data page (filters, point sizing)                                                                                     |
| ⊞ Grid             | Open Grid page (scaling, tick density, tick labels, grid visibility)                                                       |
| ☐ Isolate          | Open Isolate page (octant gizmo) — lights up when an octant is isolated                                                    |
| ▶\_ Terminal       | Open the Console page (session diagnostics) — lights up with an un-reviewed-issue badge when an error or warning is logged |

### Data Page

The Data page controls which points are visible and how they appear.

#### Class Visibility Filtering

- Each classification category appears as a toggle with its color swatch.
- Uncheck a class to hide all points of that category.
- Hidden points are excluded from the draw call — instant toggle, no reallocation.

#### Per-Axis Numeric Filters

Filter points by value range on any axis:

1. Select an axis (X, Y, or Z).
2. Choose an operator: `>`, `≥`, `<`, `≤`, `=`, or `between`.
3. Enter one or two numeric values.
4. Only points matching all active filters remain visible.

> **Tip:** Combine class filters and numeric filters to isolate specific threat clusters.

#### Point Size Scaling

- **Auto-size:** Point size adjusts automatically based on dataset density. Denser datasets get smaller points so they don't visually merge.
- **Manual multiplier:** Use the slider to scale all points up or down.
- **Reset:** One-click return to automatic sizing.

![Data page showing class filters and point size controls](docs/images/filter.jpg)

#### Point Transparency

Points render with partial transparency, so overlapping or closely-clustered observations remain visible instead of merging into a single solid shape. This is especially noticeable when many points share the same or similar coordinates — for example, when two identical columns are mapped to the same axis, or when a dataset has several observations with very close values.

Where points overlap, you'll see a darker or more saturated blend of their colors — this is a visual cue that multiple observations exist at that location, not a rendering error. Points always render at their exact plotted coordinates; transparency only changes how they're drawn, never where the data actually sits.

### Grid Page

The Grid page controls how the reference grid is displayed and scaled.

#### Show Grid

Toggle the wireframe box and grid plane on or off. Axis lines, tick marks, and labels remain visible even when the grid is hidden.

#### Tick Labels

Toggle tick marks and numeric labels independently for each axis (X, Y, Z). Hiding ticks declutters the view without removing the axis line itself.

#### Tick Density

A slider (3–30, default 10) controls how many tick marks appear along each axis. The actual step size is rounded to a "nice" number (1, 2, or 5 × a power of 10) so labels remain human-readable. Higher values = finer granularity.

> **Note:** Tick marks and numbers automatically scale to stay a constant size on screen as you zoom in and out. Zooming in spreads ticks apart; zooming out pushes outer ones off-screen.

#### Scaling Modes

| Mode                          | Behavior                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-normalized** (default) | Each axis fills the box independently based on its own data range. Good for comparing shape when magnitudes differ wildly.                                |
| **Auto-real scale**           | One shared scale factor from the global farthest value across all axes. A unit of data is the same render length on every axis — true relative distances. |
| **Custom**                    | Type a ± bound per axis. Any axis left blank falls back to its auto-normalized value. Useful for forcing a specific plotting range.                       |

Mode changes recompute the grid live. In **Auto-real scale**, small-range axes will bunch near the origin rather than filling the box.

### Isolate Page

The Isolate page lets you focus on one spatial corner (octant) of the data.

#### Octant Gizmo

A small 3D cube-of-cubes mirrors the main view's rotation, so the spatial corner you click is the one currently occupying that on-screen position.

| Action                                        | Result                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| **Click a cube**                              | That octant enlarges to fill the entire grid; all points outside it are hidden |
| **Click the same cube again**                 | Reverts to the full grid (toggle behavior)                                     |
| **Click inside the outline but off any cube** | Reverts to the full grid                                                       |
| **Click Reset**                               | Reverts to the full grid                                                       |

When an octant is isolated:

- The grid rescales so the selected corner fills the box
- The axes reposition so data-zero sits at a box corner instead of the center
- Tick marks automatically refine to match the narrower range
- The **Box icon** in the icon strip lights up, so you know a filter is active even with the panel closed
- A status line names the isolated corner by its real column names (e.g., `+ orig_bytes`, `− invel_pps`, `+ invel_bpp`)

> **Note:** Isolation is cleared automatically when you load a new CSV — an octant chosen for one dataset means nothing for another.

![Isolate page with octant gizmo showing all 8 cubes](docs/images/isolate.cube.jpg)

---

## 7. Loading Your Own CSV Dataset

Orinoco ships with no default dataset — you load your own CSV directly in-browser, as long as it matches the expected shape.

### 7.1 Expected Format

Your CSV should have:

- **At least 2 numeric columns** — with exactly 2, the dataset renders as a 2D flat plane (Z synthesized as 0). With 3 or more, the first three (in header order) become the default X/Y/Z — see **7.4 Manual Axis Mapping** below to change this
- **At least 1 text column** — the column with the highest ratio of unique values becomes the **UID**; the next text column becomes the **Classification**. Any further text columns are captured as point metadata and shown when hovering a point
- **A header row** — column names are used for axis labels, dropdown options, and HUD display

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

### 7.4 Manual Axis Mapping

If a loaded dataset has more than 2 numeric columns, an **Axis Mapping** section appears in the Data panel with three dropdowns — X, Y, and Z. Each lists every numeric column detected in the file.

- Changing X or Y immediately re-renders the point cloud using the newly selected column — no re-upload needed, since the original parsed rows are retained in memory
- The Z dropdown includes a **None (2D)** option — selecting it flattens the view to a 2D plane (Z synthesized as 0), regardless of how many numeric columns the file actually has
- Axis labels, the Value filter panel, and the Point Analysis HUD all update to reflect the active mapping

> **Note:** With exactly 2 numeric columns, the Axis Mapping section doesn't appear — there's nothing to choose between, since both columns are already in use.

### 7.5 Error Handling

If the file fails to load, you will see a specific error message:

| Error                       | Cause                                                 |
| --------------------------- | ----------------------------------------------------- |
| Empty file                  | The file has no header row or no data rows            |
| Not enough numeric columns  | The CSV has fewer than 2 numeric columns              |
| No text/label columns found | The CSV lacks text columns for UID and Classification |
| No valid data rows          | Every row had missing or invalid numeric values       |
| File read error             | The browser could not read the file                   |

> **Partial load banner:** If your CSV loads but some rows are skipped due to missing or invalid numeric values, a red banner appears showing which row numbers were excluded. The valid rows still render — you do not need to reload the file.

### 7.6 Known Limitations

- Manual axis mapping only appears once a dataset has more than 2 numeric columns — see **7.4**.
- No manual override for which text column becomes UID vs. Classification — this is auto-detected by uniqueness ratio, though additional text columns beyond these two are captured as metadata rather than ignored (see **7.1**).
- Datasets are held in memory only — reloading the page clears the current dataset and returns to the empty-state prompt (see **3.3**).

### 7.7 Loading Custom Classification Colors

Classification colors resolve in this order: a manually loaded override, then the built-in table (see **5.3 Class Colors**), then a color generated deterministically from the class name. Analysts can supply overrides with a custom `colors.csv` file.

#### Format

A `colors.csv` file needs a class-name column and a color column — column names are matched flexibly (case-insensitive, ignoring spaces, underscores, and hyphens), so small header variations are still accepted.

```csv
className,color
class_00000,#390062
class_00001,#0cce35
class_00002,#8cd0a4
```

- **A header row is required.** If neither a recognizable class-name column nor a recognizable color column is found, the entire file is rejected — this is a whole-file error, not a per-row skip.
- **One row per class.** Extra columns beyond the class-name and color columns are ignored rather than causing a rejection.

#### Loading Steps

1. Click the **palette icon** in the toolbar.
2. Select your `colors.csv` file.
3. Matching class names in the active dataset immediately update to the specified colors, in both the point cloud and the HUD legend.

#### Precedence

A loaded `colors.csv` override takes priority over both the built-in color table and the deterministically generated fallback, for any class name it matches.

#### Validation Against the Loaded Dataset

- If you load `colors.csv` before loading any dataset, override validation is deferred — the Console logs that overrides were applied but can't be checked yet. Once you load a CSV, those overrides are automatically re-validated against the new dataset's actual classes.
- If you load `colors.csv` while a dataset is already active, any class name in the file that doesn't match a class in that dataset is flagged in the Console as unmatched (a warning, not an error — the load still succeeds).

#### Error Handling

Once the file's headers are recognized, individual rows are skipped (rather than failing the whole file) if the class name is empty, the color value is empty, or the color doesn't match the expected format. Skipped rows are reported in the **Console**, the same way dataset CSV row exclusions are reported.

---

## 8. Troubleshooting

### I loaded a CSV but don't see any points

1. Check the **Data page** — a class filter or numeric filter may be hiding all points.
2. Check the **Isolate page** — an active octant isolation may be filtering out your data.
3. Verify your CSV loaded without errors. Check the browser console for parse messages.

### The camera is lost / I can't see the data

1. Click the **reset button** in the toolbar to return to the origin.
2. Press **S** a few times to zoom out and reorient.
3. The camera cannot zoom farther than 18 units from the pivot — if you hit the limit, orbit to a new angle.

### I can't orbit or tilt the camera — it's locked flat

This is expected behavior for a **2D dataset** (one with no Z-axis column mapped). Orinoco automatically locks the camera to a flat, top-down view over the X/Y plane, since orbiting a flat dataset would make it appear as a sliver or disappear entirely. Look for the **"2D · Camera Locked"** indicator near the Axis Mapping controls in the Data page — this confirms the lock is intentional, not a bug. Mapping a Z column back in (see **7.4**) restores normal 3D orbit/tilt controls.

### The grid disappeared

- Open the **Grid page** in the toolbar and check the **Show grid** checkbox.

### Points are too small or too large

- Open the **Data page** in the toolbar.
- Adjust the **Point Size** slider.
- Click **Reset** to return to automatic density-based sizing.

### Axis labels show wrong names

- Axis labels are drawn from your CSV's header row.
- If labels don't match expectations, verify your CSV columns are in the correct order before loading.

### Performance is slow with a large dataset

- Orinoco uses **instanced mesh rendering** and has been tested with 100,000+ points.
- If performance degrades:
  - Use **class filters** to hide categories you don't need
  - Use **numeric filters** to reduce the visible point count
  - Use **octant isolation** to focus on a spatial subset
  - Ensure your browser's hardware acceleration is enabled

---

## 9. Keyboard & Mouse Reference

### Keyboard

| Key                 | Action                             |
| ------------------- | ---------------------------------- |
| **W**               | Move camera toward pivot           |
| **S**               | Move camera away from pivot        |
| **A**               | Orbit camera left around pivot     |
| **D**               | Orbit camera right around pivot    |
| **←** (Arrow Left)  | Move pivot along X axis (negative) |
| **→** (Arrow Right) | Move pivot along X axis (positive) |
| **↑** (Arrow Up)    | Move pivot along Z axis (negative) |
| **↓** (Arrow Down)  | Move pivot along Z axis (positive) |
| **Space**           | Raise pivot along Y axis           |
| **Shift**           | Lower pivot along Y axis           |

### Mouse

| Action                | Effect                         |
| --------------------- | ------------------------------ |
| **Hover**             | Inspect point metadata in HUD  |
| **Click**             | Set clicked point as new pivot |
| **Drag (Orbit mode)** | Rotate camera around pivot     |
| **Drag (Pan mode)**   | Translate view                 |

### Toolbar Shortcuts

| Icon               | Click Action                     |
| ------------------ | -------------------------------- |
| 🌙 / ☀️ Moon / Sun | Toggle dark / light mode         |
| 📎 Paperclip       | Load CSV file                    |
| 🎨 Palette         | Load `colors.csv` color override |
| 🔄 Reset           | Return pivot to origin           |
| ✋ Hand / Pointer  | Toggle Orbit vs Pan mode         |
| 🗄️ Data            | Open Data filters page           |
| ⊞ Grid             | Open Grid display page           |
| ☐ Isolate          | Open Isolate octant page         |
| ▶\_ Terminal       | Open Console diagnostics page    |

![Bottom HUD showing keyboard controls and class color legend](docs/images/hud.jpg)

---

## Support & Feedback

- **Repository:** [github.com/cwheelus/orinoco](https://github.com/cwheelus/orinoco)
- **Issues:** Report bugs and request features via the GitHub Issues tab
- **Demo Videos:** See the repository README for walkthrough recordings

---

_© 2026 Sentient Solutions_
