import { useState, useRef, useEffect, useMemo } from "react";
import type { Group } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Line } from "@react-three/drei";
import { Paperclip } from "lucide-react";
import { useStore, formatSkippedRows, selectIs2D } from "./store/useStore";
import { PointCloud } from "./components/PointCloud";
import {
  CameraRig,
  MIN_ZOOM_DIST,
  MAX_ZOOM_DIST,
} from "./components/CameraRig";
import { Axes } from "./components/Axes";
import { CartesianGrid } from "./components/CartesianGrid";
import { IsolationTransition } from "./components/IsolationTransition";
import { Toolbar } from "./components/Toolbar";
import { parseCSV } from "./lib/parseCSV";
import { parseColorsCSV } from "./lib/parseColorsCSV";
import { getClassColor } from "./lib/classColors";
import { getUnmatchedColorOverrides } from "./lib/colorValidation";
import { truncateLabel } from "./lib/truncateLabel";
import { SURFACE, PANEL_APP, TEXT, ERROR, WARNING, KBD } from "./lib/theme";
import { config } from "./lib/config";
import { appError, describeError, CODES } from "./lib/errorCodes";

// Path or URL of a dataset to load on startup, or blank. Blank is the
// SHIPPED DEFAULT and means the app starts with no data at all — see
// #57. There is deliberately no bundled fallback: the product opens
// empty and prompts for a CSV, rather than showing a demo dataset an
// analyst has to notice isn't theirs. A deployer who does want a
// dataset on open sets this to something the browser can fetch.
const STARTUP_DATASET = config.data.sampleDataset.trim();

// Where the camera sits before any user input.
const INITIAL_CAMERA_POSITION = config.camera.initialPosition;

/**
 * Orinoco Flow Visualizer - Main Application Entry
 *
 * ARCHITECTURE:
 * - UI Layer: HTML/Tailwind over the 3D Canvas (zIndex: 10)
 * - 3D Layer: React Three Fiber (R3F) for WebGL rendering
 * - State: Zustand store (useStore) for cross-component sync (pivoting,
 *   hovering, the active dataset, and its derived grid geometry/labels)
 * - One exception to the store-driven pattern above: the pivot cross
 *   marker (pivotMarkerRef, near the bottom of this component) is
 *   driven imperatively by CameraRig every frame instead of reading
 *   `pivot` from the store — a state-driven marker lagged a frame
 *   behind the camera's own imperative movement, since store updates
 *   commit asynchronously relative to useFrame's per-frame mutations.
 *   See #23 for the full reasoning.
 *
 * This file renders two layers stacked on top of each other: a flat 2D
 * HTML layer (text, buttons, info panels) and a 3D <Canvas> layer
 * beneath it (the navigable scene). The two layers never reference each
 * other directly — both read from the same Zustand store, so state
 * changes in one (e.g. a 3D point being hovered, or a new CSV loaded)
 * can update the other without any direct coupling between them.
 *
 * STYLING: colors are pulled from ./lib/theme.ts's token objects
 * (SURFACE, PANEL_APP, TEXT, ERROR, KBD) instead of inline Tailwind
 * classes — see theme.ts's header comment for why, and Toolbar.tsx for
 * the other half of the app's UI that uses the same file's tokens.
 */

// A single keyboard-key chip, e.g. the "A" in "Orbit (A/D)". Extracted
// as its own component rather than repeating the same className string
// by hand 7 times (A, D, W, S, the arrow-cluster, Spc, Shift) — adding
// an 8th key later is one line here, not a copy-pasted <kbd> block.
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={KBD.base}>{children}</kbd>;
}

// The thin vertical separator between control-guide groups (Orbit |
// Depth | Pivot). Was two identical hand-written divs; a 4th group
// later is one line, not a copy-pasted div.
function ControlGuideDivider() {
  return (
    <div
      className={`w-[1px] ${PANEL_APP.hairline} border-l h-6 self-end mb-1`}
    />
  );
}

// The three axis segments of the pivot cross marker, as [start, end]
// point pairs. Was three near-identical <Line> blocks differing only
// in `points`, each carrying its own copy of the same depthTest/
// renderOrder explanation — mapped here instead so the explanation is
// written once, and a hypothetical 4th marker segment is one array
// entry, not a whole copied block.
const CROSSHAIR_SEGMENTS: [
  [number, number, number],
  [number, number, number],
][] = [
  [
    [-0.15, 0, 0],
    [0.15, 0, 0],
  ],
  [
    [0, -0.15, 0],
    [0, 0.15, 0],
  ],
  [
    [0, 0, -0.15],
    [0, 0, 0.15],
  ],
];

function App() {
  // "pivot": the point the camera currently orbits around. Starts at
  // the world origin (0,0,0) and updates when a data point is clicked
  // (see PointCloud.tsx's onClick handler), or when a CSV is loaded
  // (setDataPoints resets it back to origin — see useStore.ts). Read
  // here for OrbitControls' target below; the pivot MARKER, by
  // contrast, does not read this value directly — see pivotMarkerRef
  // just below for why.
  const pivot = useStore((state) => state.pivot);
  // 2D mode is active when a dataset is loaded and no Z column is mapped.
  // In 2D, the camera is locked to a flat X/Y view (looking down Z)
  // and mouse orbit is disabled (#62).
  const is2D = useStore(selectIs2D);
  // Which mouse-drag mode is active: "orbit" (default, rotates around the
  // pivot) or "pan" (translates the camera/pivot instead — handled by
  // CameraRig's drag listener, not OrbitControls). Also used below to
  // disable OrbitControls' rotation while panning, and to swap the cursor.
  const activeTool = useStore((state) => state.activeTool);
  // The data point object currently under the cursor, or null if
  // nothing is being hovered. Drives the conditional HUD panel below.
  const hoveredPoint = useStore((state) => state.hoveredPoint);
  // Which axis label is hovered, if any — drives the full-name
  // tooltip below, since Axes.tsx's WebGL Text has no native title.
  const hoveredAxis = useStore((state) => state.hoveredAxis);
  // Which real column is plotted on each axis (e.g. "orig_bytes"),
  // used below so the Point Analysis panel's metric labels always
  // match whatever's actually loaded, instead of hardcoded letters.
  const axisLabels = useStore((state) => state.axisLabels);
  // Whether the grid box is currently shown — toggled from the
  // Toolbar's grid on/off icon.
  const gridVisible = useStore((state) => state.gridVisible);
  // Full dataset — needed for the color legend so unknown classes get
  // their deterministic generated color instead of being silently omitted.
  const dataPoints = useStore((state) => state.dataPoints);
  // null until a dataset has been loaded — the store's own "nothing
  // loaded yet" signal (see selectIs2D's comment in useStore.ts), and
  // what drives the empty-state prompt below. Preferred over
  // `dataPoints.length === 0` because it distinguishes "no file yet"
  // from "a file that legitimately produced no points".
  const columnMapping = useStore((state) => state.columnMapping);
  // Analyst's manual color picks for classes — passed to getClassColor()
  // as the highest-precedence source. Populated by the colors.csv
  // loader (see lib/parseColorsCSV.ts), not an in-app picker — see
  // original spec and the #43 discussion.
  const classColorOverrides = useStore((state) => state.classColorOverrides);
  // Class names actually present in the loaded dataset — used to
  // cross-check colors.csv overrides against real classes when
  // colors load AFTER a dataset already exists. See #59.
  const availableClasses = useStore((state) => state.availableClasses);
  // Non-numeric field values for the currently-hovered point, keyed
  // by uid — see lib/parseCSV.ts's ParseResult.metadata for the
  // shape. null until the first dataset loads.
  const pointMetadata = useStore((state) => state.pointMetadata);
  // Setter for the colors.csv loader below — replaces the whole
  // override map at once rather than looping setClassColor per row.
  const setClassColorOverrides = useStore(
    (state) => state.setClassColorOverrides,
  );
  // Whether the interface is in dark or light mode — toggled from the
  // Toolbar's sun/moon icon. Drives the "light" class applied to the
  // root div below, which activates every theme.ts token's light:
  // variant (see index.css's @custom-variant declaration for why this
  // is a manual class rather than Tailwind's OS-driven dark: default).
  const darkMode = useStore((state) => state.darkMode);
  // Replaces the active dataset (and its derived grid geometry/axis
  // labels, computed together — see useStore.ts's setDataPoints).
  const setDataPoints = useStore((state) => state.setDataPoints);
  // Ref to the pivot cross marker group below. CameraRig drives its
  // position imperatively every frame (in lockstep with the camera), so
  // the marker is intentionally NOT bound to the `pivot` state — a state
  // binding lags a frame behind the imperative camera movement. (From
  // #23's fix for marker lag.)
  const pivotMarkerRef = useRef<Group>(null);

  // Diagnostics now live in the STORE rather than in a local
  // useState<string>. Two reasons the old local slot couldn't work:
  // the Console page (in Toolbar.tsx) needs to read the same records,
  // and a single string could only ever hold one message — each new
  // load destroyed the previous one.
  const logEntries = useStore((state) => state.logEntries);
  const pushLog = useStore((state) => state.pushLog);

  // The banner shows only the newest ERROR or WARNING. Info entries
  // (successful loads) are Console-only — surfacing those as a banner
  // would mean a notification on every routine load.
  // `dismissedLogId` lets the analyst close the banner without clearing
  // the Console's record; a newer diagnostic has a higher id, so it
  // reappears on the next problem rather than staying suppressed.
  const [dismissedLogId, setDismissedLogId] = useState(0);

  // True only while a CONFIGURED startup dataset is in flight. Without
  // it the empty-state prompt below would flash on first paint of a
  // deployment that does auto-load, telling the analyst to pick a file
  // a moment before one appears on its own. Starts false in the shipped
  // configuration, where there is nothing to wait for.
  const [startupPending, setStartupPending] = useState(
    () => STARTUP_DATASET !== "",
  );
  const activeAlert = useMemo(() => {
    for (let i = logEntries.length - 1; i >= 0; i--) {
      const entry = logEntries[i];
      if (entry.severity === "info") continue;
      return entry.id > dismissedLogId ? entry : null;
    }
    return null;
  }, [logEntries, dismissedLogId]);

  // Handles a file selected via the Toolbar's paperclip button. Three
  // possible outcomes, each handled distinctly rather than collapsed
  // into a single success/failure branch:
  //  1. Full success (no skipped rows) — dataset replaces the old one,
  //     no banner shown, since nothing needs flagging to the user.
  //  2. Partial success (some rows skipped) — dataset still loads and
  //     replaces the old one, but a banner surfaces which row numbers
  //     were excluded, so the analyst knows their point count may not
  //     match every row in the source file.
  //  3. Failure (parseCSV rejects) — nothing replaces the current
  //     dataset; the previously-loaded dataset stays active, and the
  //     banner shows parseCSV's specific error
  //     message (wrong column count, empty file, etc.) rather than a
  //     generic "something went wrong."
  const handleFileSelected = async (file: File) => {
    try {
      const {
        rows,
        points,
        mapping,
        schema,
        metadata,
        skippedRows,
        interpretation,
      } = await parseCSV(file);
      setDataPoints(
        points,
        {
          x: mapping.x,
          y: mapping.y,
          z: mapping.z ?? config.defaults.unmappedAxisLabel,
        },
        schema,
        metadata,
        rows,
        mapping,
      );

      // #59: re-validate any ALREADY-LOADED colors.csv overrides
      // against THIS newly parsed dataset — never against the
      // previous one (points, not dataPoints/availableClasses, which
      // haven't recomputed in this synchronous handler yet). Silent
      // on a match: CLR-100 means "colors.csv loaded successfully,"
      // not "an existing override set was re-checked" — those are
      // different events. Diagnostics are historical, so an earlier
      // CLR-051 from a prior dataset is never retroactively cleared;
      // this only ever adds a NEW entry if THIS dataset has a mismatch.
      if (Object.keys(classColorOverrides).length > 0) {
        const newAvailableClasses = [
          ...new Set(points.map((p) => p.className)),
        ];
        const unmatched = getUnmatchedColorOverrides(
          classColorOverrides,
          newAvailableClasses,
        );
        if (unmatched.length > 0) {
          pushLog(
            CODES.CLR_UNMATCHED_CLASS,
            `${unmatched.length} color override(s) don't match any class in ${file.name}.`,
            [
              `Unmatched (check for typos): ${unmatched.join(", ")}`,
              `Loaded dataset classes: ${newAvailableClasses.join(", ")}`,
            ],
          );
        }
      }

      // Product decision (updated): every text column beyond uid/class
      // is reported, including columns at numericCount === 0 — a
      // successful load should never silently drop a column with zero
      // indication, regardless of severity. This deliberately includes
      // ordinary text metadata (department, description, etc.) alongside
      // genuine near-miss/garbled-axis columns, since the parser has no
      // way to distinguish the two — matching how established tools
      // (pandas' DtypeWarning, Tableau's Data Interpreter) prefer
      // over-informing to silent gaps. See parseCSV.ts's
      // ParseInterpretation for what the parser actually knows.
      //
      // Hoisted out of the skippedRows if/else (Copilot review, PR #65):
      // this must run on EVERY successful load, not just the fully-clean
      // path — a partial-success load (some rows skipped) is still a
      // successful load, and previously received no classification
      // evidence at all, contradicting TESTING_GUIDE.md's documented
      // "on every successful load" contract.
      const interpretationDetails = interpretation.columns
        .filter(
          ({ column }) =>
            column !== mapping.uid && column !== mapping.className,
        )
        .map(({ column, numericCount, sampledCount, sampleBadValues }) =>
          // sampledCount === 0 means every value in the sample was empty —
          // "0/0 sampled values numeric" reads like a math error, not a
          // diagnostic. Special-cased separately from the genuine
          // numericCount === 0 case (which DOES have samples, they're
          // just all non-numeric).
          sampledCount === 0
            ? `Column "${column}": no sampled values`
            : numericCount === 0
              ? `Column "${column}": text (0/${sampledCount} sampled values numeric)`
              : `Column "${column}" excluded from numeric classification: ` +
                `${numericCount}/${sampledCount} sampled values numeric` +
                (sampleBadValues.length
                  ? ` — examples: ${sampleBadValues.map((v) => `"${v}"`).join(", ")}`
                  : ""),
        );

      if (skippedRows.length > 0) {
        // Not a hard failure — the file loaded, just with some rows
        // excluded. Logged as a WARNING so the banner shows it without
        // implying the load failed. The per-row reasons AND the
        // classification evidence both go into this single warning's
        // detail, rather than splitting one load across two Console
        // entries (Copilot review, PR #65).
        pushLog(
          CODES.CSV_ROWS_SKIPPED,
          `${file.name}: loaded ${points.length} point(s), excluded ${skippedRows.length} row(s).`,
          [...formatSkippedRows(skippedRows), ...interpretationDetails],
        );
      } else {
        pushLog(
          CODES.CSV_LOADED,
          `${file.name}: loaded ${points.length} point(s) from ${rows.length} row(s).`,
          [
            `Axes: ${mapping.x} / ${mapping.y} / ${mapping.z ?? "none (2D)"}`,
            `Identity: ${mapping.uid} · Class: ${mapping.className}`,
            ...interpretationDetails,
          ],
        );
      }
    } catch (err) {
      // describeError narrows to the thrown AppError's registry entry,
      // or APP-001 for anything uncoded — so nothing reaches the user
      // without a code attached.
      const { appCode, message, detail } = describeError(
        err,
        "Failed to load CSV.",
      );
      pushLog(appCode, `${file.name}: ${message}`, detail);
    }
  };

  // Loads a colors.csv (className,color) to override the deterministic
  // generated colors — see lib/parseColorsCSV.ts and lib/classColors.ts
  // for the precedence chain (override > built-in > generated). Per
  // Charles's original spec: colors are "set and changed from that
  // file," not via an in-app picker.
  const handleColorFileSelected = async (file: File) => {
    try {
      const { overrides, skippedRows } = await parseColorsCSV(file);
      setClassColorOverrides(overrides);
      const applied = Object.keys(overrides).length;
      // Single source of truth for "is a dataset currently loaded" —
      // dataPoints, not availableClasses (which is derived FROM
      // dataPoints and shouldn't also be relied on as the load
      // signal — see #59 discussion). Any successfully loaded
      // dataset is structurally guaranteed at least one point.
      const datasetLoaded = dataPoints.length > 0;

      if (skippedRows.length > 0) {
        pushLog(
          CODES.CLR_ROWS_SKIPPED,
          `${file.name}: applied ${applied} color override(s), excluded ${skippedRows.length} row(s).`,
          formatSkippedRows(skippedRows),
        );
      }

      if (!datasetLoaded) {
        pushLog(
          CODES.CLR_VALIDATION_DEFERRED,
          `${file.name}: applied ${applied} color override(s). Load a dataset before validating color overrides.`,
          Object.entries(overrides).map(([cls, hex]) => `${cls} → ${hex}`),
        );
      } else {
        const unmatched = getUnmatchedColorOverrides(
          overrides,
          availableClasses,
        );
        if (unmatched.length > 0) {
          pushLog(
            CODES.CLR_UNMATCHED_CLASS,
            `${unmatched.length} of ${applied} color override(s) don't match any loaded class.`,
            [
              `Unmatched (check for typos): ${unmatched.join(", ")}`,
              `Loaded dataset classes: ${availableClasses.join(", ")}`,
            ],
          );
        } else if (skippedRows.length === 0) {
          pushLog(
            CODES.CLR_LOADED,
            `${file.name}: applied ${applied} color override(s).`,
            Object.entries(overrides).map(([cls, hex]) => `${cls} → ${hex}`),
          );
        }
      }
    } catch (err) {
      const { appCode, message, detail } = describeError(
        err,
        "Failed to load color file.",
      );
      pushLog(appCode, `${file.name}: ${message}`, detail);
    }
  };

  // Load a CONFIGURED startup dataset once on mount, through the same
  // parseCSV → setDataPoints pipeline as a user upload — so it's the
  // initial dataset without any separate hardcoded-data code path. The
  // fetched text is wrapped in a File so parseCSV (which takes a File)
  // is reused verbatim. Skipped-row banners are intentionally not
  // surfaced here, since this isn't a user-initiated load; hard
  // failures still are, via the same banner a manual upload would use.
  useEffect(() => {
    // The shipped default. No configured dataset means the app opens
    // empty and waits for the analyst's own CSV (#57) — the empty-state
    // prompt in the HUD below covers this case.
    if (!STARTUP_DATASET) {
      setStartupPending(false);
      return;
    }

    // Guards against a late resolve landing after unmount (or after a
    // fast-refresh remount) and writing to a stale store subscription.
    let cancelled = false;

    // Fetched at runtime rather than bundled at build time, so a
    // deployer can point the app at their own file without a rebuild.
    const fetchStartupDataset = async (): Promise<File> => {
      const response = await fetch(STARTUP_DATASET);
      if (!response.ok) {
        throw appError(
          CODES.CSV_FETCH_FAILED,
          `Could not load the configured startup dataset "${STARTUP_DATASET}" (HTTP ${response.status}).`,
          [
            "Set data.sampleDataset in config.json to a path the browser can fetch,",
            "or leave it blank to start with no dataset and load one from the toolbar.",
          ],
        );
      }
      // A single-page host typically rewrites unknown paths to
      // index.html with a 200 rather than a 404, so `response.ok` alone
      // doesn't mean the file was found. Without this check a mistyped
      // path feeds HTML to the CSV parser, which then reports a
      // confusing "0 numeric columns" instead of a bad path.
      if (response.headers.get("content-type")?.includes("text/html")) {
        throw appError(
          CODES.CSV_NOT_CSV,
          `The configured startup dataset "${STARTUP_DATASET}" returned an HTML page, not a CSV file.`,
          [
            "The path is probably wrong — most hosts serve index.html with a 200 for unknown paths.",
            "Check data.sampleDataset in config.json.",
          ],
        );
      }
      const text = await response.text();
      // Name the File after the fetched path so any parse error message
      // names the real file rather than a placeholder.
      const name = STARTUP_DATASET.split("/").pop() || "dataset.csv";
      return new File([text], name, { type: "text/csv" });
    };

    fetchStartupDataset()
      .then(parseCSV)
      .then(({ rows, points, mapping, schema, metadata, skippedRows }) => {
        if (cancelled) return;
        setDataPoints(
          points,
          {
            x: mapping.x,
            y: mapping.y,
            z: mapping.z ?? config.defaults.unmappedAxisLabel,
          },
          schema,
          metadata,
          rows,
          mapping,
        );
        // Startup exclusions are logged (they belong in the Console's
        // record of the session) but at INFO level, so they don't raise
        // a red banner over a load the analyst never initiated.
        pushLog(
          CODES.CSV_LOADED,
          `${STARTUP_DATASET}: loaded ${points.length} point(s) from ${rows.length} row(s).`,
          [
            "Source: config.json data.sampleDataset",
            `Axes: ${mapping.x} / ${mapping.y} / ${mapping.z ?? "none (2D)"}`,
            ...(skippedRows.length > 0
              ? [
                  `Excluded ${skippedRows.length} row(s):`,
                  ...formatSkippedRows(skippedRows),
                ]
              : []),
          ],
        );
      })
      .catch((err) => {
        if (cancelled) return;
        const { appCode, message, detail } = describeError(
          err,
          "Failed to load the configured startup dataset.",
        );
        pushLog(appCode, message, detail);
      })
      // Whether it loaded or failed, the startup attempt is over — the
      // empty-state prompt is free to appear if nothing landed.
      .finally(() => {
        if (!cancelled) setStartupPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setDataPoints, pushLog]);

  // Unique class names from the loaded dataset, sorted for stable order.
  // Derived from dataPoints (not a hardcoded map) so any class — built-in
  // or unknown — gets a swatch in the legend. Memoized since it only
  // changes when the dataset changes, not on every hover or camera move.
  const classNames = useMemo(
    () => Array.from(new Set(dataPoints.map((p) => p.className))).sort(),
    [dataPoints],
  );

  return (
    <div
      className={`w-screen h-screen ${SURFACE.root} relative ${
        darkMode ? "" : "light"
      }`}
    >
      {/* Toolbar: data CSV loading, color-mapping CSV loading, origin
          reset, and Data/Grid/Isolate pages. Rendered as its own
          fixed-position panel — NOT nested inside the HUD's flex
          layout below — since its screen position is self-managed
          (docked + resizable, see Toolbar.tsx) rather than dictated
          by a parent flex/grid container. */}
      <Toolbar
        onFileSelected={handleFileSelected}
        onColorFileSelected={handleColorFileSelected}
      />

      {/* EMPTY STATE (#57). The app ships with no bundled dataset, so
          the first thing an analyst sees is an empty grid — which on
          its own reads as "broken" rather than "waiting for you". This
          says what to do and points at the control that does it.
          Sits outside the HUD's flex column below and is centered on
          the viewport instead: it's not part of the header/banner/
          inspector stack, and slotting it into that justify-between
          layout would push those apart. pointer-events-none so it
          never intercepts a drag on the scene behind it; the toolbar's
          own button stays the only click target. */}
      {columnMapping == null && !startupPending && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className={`max-w-sm p-5 text-center ${SURFACE.card} ring-1 ring-white/10 shadow-2xl`}
          >
            <Paperclip
              size={20}
              className={`mx-auto mb-3 ${TEXT.iconDefault}`}
            />
            <p className={`text-sm font-bold mb-1.5 ${TEXT.onFilled}`}>
              No dataset loaded
            </p>
            <p className={`text-[11px] leading-relaxed ${TEXT.emphasis}`}>
              Load a CSV with the paperclip button in the toolbar, top
              right, to plot it.
            </p>
            <p className={`text-[10px] leading-relaxed mt-2 ${TEXT.faint}`}>
              Two or more numeric columns are mapped to the axes
              automatically, and one text column labels each point.
            </p>
          </div>
        </div>
      )}

      {/* 
          1. HUD OVERLAY (2D)
          'pointer-events-none' is critical here: it allows clicks to "pass through" 
          the UI layer into the 3D Canvas unless specifically overridden by a
          child element that sets its own pointer-events value.
      */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
        {/* Branding & Status Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1
              className={`text-xl font-black tracking-tighter uppercase ${TEXT.onFilled}`}
            >
              Orinoco <span className="text-blue-500">Flow</span>
            </h1>
          </div>
          <p
            className={`text-[10px] font-mono uppercase tracking-[0.2em] ${TEXT.muted}`}
          >
            v1.0.0 // Sentient Solutions // Internal Systems
          </p>
        </div>

        {/* Diagnostic banner — the newest error or warning, on the
            left, carrying its error code. Deliberately compact: the
            code plus a one-line summary, with the full per-row detail
            one click away in the Console page rather than crammed in
            here (the old banner tried to list every excluded row number
            inline and became unreadable on any real file).
            Red for errors, amber for warnings, so a partial load isn't
            styled like a failure. */}
        {activeAlert && (
          <div
            className={`pointer-events-auto max-w-md p-3 ${
              activeAlert.severity === "error" ? ERROR.bg : WARNING.bg
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <p
                className={`text-[10px] font-bold uppercase ${
                  activeAlert.severity === "error" ? ERROR.label : WARNING.label
                }`}
              >
                <span className="font-mono">{activeAlert.code}</span>{" "}
                {activeAlert.title}
              </p>
              <button
                onClick={() => setDismissedLogId(activeAlert.id)}
                className={`text-[10px] ${TEXT.muted} hover:${TEXT.onFilled} leading-none px-1`}
                title="Dismiss (stays in the Console)"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
            <p className={`text-[11px] ${TEXT.emphasis}`}>
              {activeAlert.message}
            </p>
            {activeAlert.detail && activeAlert.detail.length > 0 && (
              <p className={`text-[10px] ${TEXT.faint} mt-1`}>
                Open the Console tab for details.
              </p>
            )}
          </div>
        )}

        {/* Axis label tooltip: shows the full, untruncated axis name
            on hover, since Axes.tsx truncates long names for display
            (#59) and its WebGL <Text> has no native DOM title. Fixed
            position near the top rather than tracking cursor/3D screen
            coordinates — simpler, and axis labels don't move around
            the viewport the way individual data points do. */}
        {hoveredAxis && (
          <div
            className={`pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 px-3 py-1.5 ${SURFACE.card} border-l-2 border-blue-500 ring-1 ring-white/10 shadow-2xl z-20`}
          >
            <span className={`text-[11px] font-mono ${TEXT.onFilled}`}>
              {axisLabels[hoveredAxis]}
            </span>
          </div>
        )}

        {/* Dynamic Point Inspector: only renders when hoveredPoint is
            truthy (i.e. a point is currently being hovered). Uses `&&`
            rather than a ternary since there's no fallback content to
            show otherwise. */}
        <div className="w-72">
          {hoveredPoint && (
            <div
              className={`p-4 ${SURFACE.card} border-l-2 border-blue-500 ring-1 ring-white/10 shadow-2xl transition-all`}
            >
              <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">
                Point Analysis
              </p>
              <div className="space-y-2">
                <div
                  className={`flex justify-between border-b ${PANEL_APP.hairline} pb-1`}
                >
                  {/* TEXT.faint (not a bare text-white/40) — this label is
                      genuinely important content an analyst reads
                      constantly, so it gets the same WCAG-compliant
                      dimmest tier as the rest of the app rather than an
                      even-fainter one-off value. See theme.ts. */}
                  <span className={`${TEXT.faint} text-[10px]`}>UID</span>
                  <span className={`${TEXT.onFilled} font-mono text-xs`}>
                    {hoveredPoint.uid}
                  </span>
                </div>
                <div
                  className={`flex justify-between items-start gap-2 border-b ${PANEL_APP.hairline} pb-1 min-w-0`}
                >
                  <span className={`${TEXT.faint} text-[10px] shrink-0`}>
                    Classification
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase break-words min-w-0 text-left"
                    style={{
                      color: getClassColor(
                        hoveredPoint.className,
                        classColorOverrides,
                      ),
                    }}
                  >
                    {hoveredPoint.className}
                  </span>
                </div>
                <div className="pt-1 space-y-1">
                  {/* Labels come from axisLabels (the real column names
                      for whatever dataset is loaded) instead of
                      hardcoded E/C/W letters — keeps this panel
                      consistent with what Axes.tsx shows on the grid
                      itself, for any dataset, not just the original one.
                      Each metric is its own label-left/value-right row,
                      matching the UID and Classification rows above,
                      rather than a 3-column grid where the axis name
                      only appeared in a header line and hover tooltip —
                      that made it easy to misread which value belonged
                      to which axis at a glance.
                      Mapped over ["x","y","z"] rather than three
                      hand-written blocks: the three rows were
                      structurally identical (same classNames, same
                      .toFixed(3) call), differing only in which axis
                      key they read — copy-pasting that three times
                      meant any future styling change had to be applied
                      in three places and risked drifting out of sync.
                      Border check uses arr.length - 1 (not the literal
                      2) so the "no border on the last row" rule stays
                      correct even if this array's size ever changes,
                      rather than depending on someone remembering to
                      update a hardcoded index alongside it. */}
                  <span className={`${TEXT.faint} text-[10px] block mb-1`}>
                    Metrics
                  </span>
                  {(["x", "y", "z"] as const).map((axis, i, arr) => (
                    <div
                      key={axis}
                      className={`flex justify-between pb-1 ${
                        i < arr.length - 1
                          ? `border-b ${PANEL_APP.hairline}`
                          : ""
                      }`}
                    >
                      <span
                        className={`${TEXT.faint} text-[10px] break-words max-w-[60%] min-w-0`}
                      >
                        {axisLabels[axis]}
                      </span>
                      <span
                        className={`${TEXT.onFilled} font-mono text-xs shrink-0`}
                      >
                        {hoveredPoint[axis].toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Non-numeric descriptive fields from the CSV (any
                    text column beyond uid/class), keyed by the
                    currently-hovered point's uid. Fully dynamic — no
                    column names hardcoded, so any CSV's extra fields
                    (source IP, hostname, department, whatever an
                    analyst's data happens to have) render automatically
                    with zero code changes. Only shows when metadata
                    genuinely exists for this point AND has at least one
                    field, so datasets with no extra text columns don't
                    render an empty, oddly-titled section. */}
                {pointMetadata?.[hoveredPoint.uid] &&
                  Object.keys(pointMetadata[hoveredPoint.uid]).length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className={`${TEXT.faint} text-[10px] block mb-1`}>
                        Details
                      </span>
                      {Object.entries(pointMetadata[hoveredPoint.uid]).map(
                        ([key, value], i, arr) => (
                          <div
                            key={key}
                            className={`flex justify-between pb-1 ${
                              i < arr.length - 1
                                ? `border-b ${PANEL_APP.hairline}`
                                : ""
                            }`}
                          >
                            <span
                              className={`${TEXT.faint} text-[10px] truncate max-w-[60%]`}
                              title={key}
                            >
                              {key}
                            </span>
                            <span
                              className={`${TEXT.onFilled} font-mono text-xs truncate max-w-[40%]`}
                              title={value}
                            >
                              {value}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom HUD: Control Guide & Classification Legend. Reset
            Pivot now lives in the Toolbar instead of here, so it isn't
            duplicated in two places. */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className={`${PANEL_APP.controlGuide} p-3 flex gap-4`}>
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Orbit (A/D)
              </span>
              <div className={`flex gap-1 ${TEXT.onFilled}`}>
                <Kbd>A</Kbd>
                <Kbd>D</Kbd>
              </div>
            </div>
            <ControlGuideDivider />
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Depth (W/S)
              </span>
              <div className={`flex gap-1 ${TEXT.onFilled}`}>
                <Kbd>W</Kbd>
                <Kbd>S</Kbd>
              </div>
            </div>
            <ControlGuideDivider />
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase opacity-40 mb-1">
                Pivot (Arrows / Spc / Shift)
              </span>
              <div className={`flex gap-1 ${TEXT.onFilled}`}>
                <Kbd>←→↑↓</Kbd>
                <Kbd>Spc</Kbd>
                <Kbd>⇧</Kbd>
              </div>
            </div>
          </div>

          {/* Color key: one swatch per unique class in the loaded dataset.
              getClassColor() resolves built-in colors (normal/nss/qc/zt) and
              generates deterministic hues for any unknown class — no white
              fallback. Replaces the old static classColors map which silently
              defaulted to white for classes outside its hardcoded four. */}
          <div className={`${PANEL_APP.legend} p-3`}>
            <div className="flex gap-4">
              {classNames.map((className) => {
                const color = getClassColor(className, classColorOverrides);
                return (
                  <div key={className} className="flex items-center gap-2">
                    <div
                      className="w-2 h-4 rounded-sm"
                      style={{
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}`,
                      }}
                    />
                    <span
                      className={`text-[10px] uppercase font-bold ${TEXT.emphasis} tracking-widest`}
                      title={className}
                    >
                      {truncateLabel(className)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* 
          2. THE 3D CANVAS (RENDER ENGINE)
          'shadows' enabled for high fidelity (optional).
      */}
      <Canvas
        shadows
        // Grab-cursor while the pan tool is active, so the viewport
        // visually signals drag-to-pan is available even before the
        // user starts dragging — otherwise the toolbar icon is the only
        // indicator, and it's easy to miss. Default cursor otherwise.
        style={{ cursor: activeTool === "pan" ? "grab" : "default" }}
      >
        {/* Sets the camera's starting position before any user input.
            The default [5,4,5] keeps the -2..2 grid box comfortably in
            frame — an earlier value of [20,20,20] made the box look too
            small. Tunable via config.json's camera.initialPosition. */}
        <PerspectiveCamera makeDefault position={INITIAL_CAMERA_POSITION} />

        {/* Lighting: a strong ambient floor so every data point is
            passively visible anywhere in the box (meshStandardMaterial
            renders near-black without light), plus one weak point light
            kept purely for directional shading — the subtle bright/dark
            gradient across each sphere that makes it read as a 3D ball
            instead of a flat disc. */}
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />

        {/* Draws the open-face reference box + axis ticks/labels.
            CartesianGrid (the box lines) can be toggled off via the
            Toolbar's grid icon; Axes (ticks/labels) stays visible
            either way, since coordinate labels remain useful on their
            own even without the box geometry. */}
        {/*
            ENGINE COMPONENTS:
            CameraRig: Custom keyboard logic for WASD + pivot traversal,
              also drives the pivot marker imperatively via pivotMarkerRef
              (see #23) so it tracks the camera with zero frame lag. Sits
              OUTSIDE IsolationTransition — it moves the camera, which must
              not be affected by the scene-space transition transform.
            PointCloud: Mapped 3D nodes from dataset
            Axes: 3D labels (Billboarded to stay readable)
        */}
        <CameraRig pivotMarkerRef={pivotMarkerRef} />

        {/* Everything that lives in grid/render space goes inside the
            transition wrapper, so isolating an octant animates as one
            coherent zoom rather than the grid, points, and labels each
            snapping independently. */}
        <IsolationTransition>
          {gridVisible && <CartesianGrid />}
          <PointCloud />
          <Axes />
        </IsolationTransition>

        {/* OrbitControls: Mouse-drag rotation only — panning is handled
            entirely by CameraRig's own pointer listener instead (see
            CameraRig.tsx), not by OrbitControls' built-in pan, to avoid
            two separate systems both trying to translate the camera.
            'target={pivot}' ensures rotation orbits around the currently
            selected point. enableRotate is gated on the active tool, so
            drag-to-rotate is suppressed while the pan tool is selected —
            the two mouse-drag modes are mutually exclusive, never both
            live at once. NOTE: camera.lookAt() still runs every frame in
            CameraRig.tsx alongside this component's own rotation — see
            the note there about the resulting drift issue (tracked in #5).
        */}
        <OrbitControls
          target={pivot}
          makeDefault
          enableRotate={activeTool === "orbit" && !is2D}
          enablePan={false}
          // Zoom guard rails (scroll dolly): can't fly infinitely far out,
          // and can't dolly through the point being looked at. The W/S
          // keys clamp to the same range in CameraRig.
          minDistance={MIN_ZOOM_DIST}
          maxDistance={MAX_ZOOM_DIST}
        />

        {/*
            TACTICAL PIVOT MARKER:
            Visual feedback identifying the 'center' of the world — a
            six-armed cross: one line segment through the pivot along each
            of the three axes (so two arms per axis, six total). Unlike
            the previous billboarded ring, the cross is a real 3D object
            whose arms foreshorten with perspective, which doubles as an
            orientation cue for which way each axis runs while traversing
            the pivot with the arrow keys.
            Position is driven imperatively by CameraRig via pivotMarkerRef
            (not `position={pivot}`), so it tracks the camera in the exact
            same frame instead of lagging a frame behind on React state
            (see #23).
        */}
        <group ref={pivotMarkerRef}>
          {/* One <Line> per entry in CROSSHAIR_SEGMENTS above, instead
              of three hand-written blocks that differed only in
              `points`. depthTest is off with a high renderOrder so the
              crosshair always draws on top of the axis lines instead
              of z-fighting them (both sit at the origin when the pivot
              is centered) — explained once here rather than three
              times inline. */}
          {CROSSHAIR_SEGMENTS.map((points, i) => (
            <Line
              key={i}
              points={points}
              color="#3b82f6"
              lineWidth={2.5}
              transparent
              opacity={0.8}
              depthTest={false}
              renderOrder={10}
            />
          ))}
          {/* Subtl light cast by the pivot marker to illuminate nearby nodes */}
          <pointLight distance={3} intensity={5} color="#3b82f6" />
        </group>
      </Canvas>
    </div>
  );
}

export default App;
