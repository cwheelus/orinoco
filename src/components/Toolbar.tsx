import { useRef, useState, useCallback } from "react";
import {
  Paperclip,
  Database,
  Grid3x3,
  Box,
  RotateCcw,
  Eye,
  EyeOff,
  Hand,
  MousePointer2,
  Sun,
  Moon,
} from "lucide-react";
import { useStore } from "../store/useStore";
import type { AxisKey, FilterOp, ScalingMode } from "../store/useStore";
import { PANEL, TEXT, LINK, INPUT, HOVER, ICON_BUTTON } from "../lib/theme";

// Scaling-mode options for the Grid page, in display order.
const SCALING_MODES: { value: ScalingMode; label: string; hint: string }[] = [
  {
    value: "normalized",
    label: "Auto-normalized",
    hint: "Each axis fills the box against its own range.",
  },
  {
    value: "real",
    label: "Auto-real scale",
    hint: "One shared scale — true relative distances across axes.",
  },
  {
    value: "custom",
    label: "Custom",
    hint: "Type a ± bound per axis below.",
  },
];
import { classColors, DEFAULT_CLASS_COLOR } from "../lib/classColors";
import { OctantGizmo } from "./OctantGizmo";

// Operator dropdown options for the numeric filters, in display order.
// "off" (—) means the axis isn't filtered.
const FILTER_OPS: { value: FilterOp; label: string }[] = [
  { value: "off", label: "—" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "eq", label: "=" },
  { value: "between", label: "><" },
];

/**
 * Toolbar.tsx
 *
 * Blender-style docked side panel. The icon tab strip sits FIXED
 * between the viewport and the content pane — it never moves. The
 * content pane extends from the icon strip out to the screen's right
 * edge, and dragging the border on the icon strip's viewport-facing
 * side resizes the whole panel.
 *
 * LAYOUT: [viewport] | [resize border] | [icon strip, fixed] |
 * [content pane, resizable] | (screen's right edge)
 *
 * STYLING: colors are pulled from ../lib/theme.ts's token objects
 * (PANEL, TEXT, LINK, INPUT, HOVER, ICON_BUTTON) instead of inline
 * Tailwind classes — see theme.ts's header comment for why. Only
 * one-off classes that don't repeat elsewhere (layout, spacing,
 * sizing) stay as raw Tailwind in this file.
 *
 * ICON STRIP CONTENTS:
 *  - Dark/light mode toggle (action, flips darkMode in the store —
 *    see lib/theme.ts's light: variants and index.css's custom
 *    variant declaration for how this actually recolors the app)
 *  - Load CSV (action)
 *  - Reset pivot to origin (action)
 *  - Grid on/off (action, toggles gridVisible in the store — fully
 *    functional now, wired to CartesianGrid's render in App.tsx)
 *  - Orbit/Pan toggle (action, switches mouse-drag behavior between
 *    orbit and pan via activeTool in the store — see CameraRig.tsx)
 *  - Data (page — class-visibility filtering, per-axis numeric
 *    filters, and point-size scaling. Fully functional; see #32)
 *  - Grid (page — per-axis tick label visibility, tick density,
 *    and scaling mode selection)
 *  - Isolate (page — the octant gizmo)
 */
interface ToolbarProps {
  onFileSelected: (file: File) => void;
}

type PageKey = "data" | "grid" | "isolate";

// Fixed width of the icon strip itself, in pixels — this never
// changes, unlike contentWidth below. Used both for layout (the
// icon strip's own style.width) and for the resize math, since the
// content pane's width has to account for the icon strip already
// occupying space between the resize border and the screen's edge.
const ICON_STRIP_WIDTH = 40;
// Content pane width the panel opens to when a page icon is clicked
// (as opposed to manually dragged to a custom width).
const DEFAULT_OPEN_WIDTH = 224;
// Resize drag is clamped to this range so the panel can't be dragged
// down to an unreadably thin sliver, or out wider than is useful.
const MIN_OPEN_WIDTH = 120;
const MAX_OPEN_WIDTH = 400;
// On RELEASE, if the content pane is narrower than this, the panel
// finishes closing (animates to width 0, activePage cleared) rather
// than settling at MIN_OPEN_WIDTH. During the drag itself the pane now
// tracks the cursor continuously all the way down to 0 (see
// handleResizeMove) — this threshold only decides which way it settles
// when you let go: below it closes, above it snaps up to MIN_OPEN_WIDTH.
// Both settles animate (the transition is re-enabled on release), so
// there's no crude snap-shut mid-drag.
const CLOSE_THRESHOLD = 60;

export function Toolbar({ onFileSelected }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setPivot = useStore((state) => state.setPivot);
  const gridVisible = useStore((state) => state.gridVisible);
  const pointSizeScale = useStore((state) => state.pointSizeScale);
  const setPointSizeScale = useStore((state) => state.setPointSizeScale);
  const toggleGrid = useStore((state) => state.toggleGrid);
  // Dark/light mode + its toggle — drives the icon-strip's sun/moon
  // button, the very first action in the strip (see below).
  const darkMode = useStore((state) => state.darkMode);
  const toggleDarkMode = useStore((state) => state.toggleDarkMode);
  const activeTool = useStore((state) => state.activeTool);
  const setActiveTool = useStore((state) => state.setActiveTool);
  const axisLabels = useStore((state) => state.axisLabels);
  const availableClasses = useStore((state) => state.availableClasses);
  const hiddenClasses = useStore((state) => state.hiddenClasses);
  const numericFilters = useStore((state) => state.numericFilters);
  const toggleClassHidden = useStore((state) => state.toggleClassHidden);
  const setNumericFilter = useStore((state) => state.setNumericFilter);
  const clearFilters = useStore((state) => state.clearFilters);
  // Which axes' tick marks/numbers are currently hidden, and the
  // setter to toggle one — drives the Grid page's tick-visibility
  // checkboxes.
  const hiddenTickAxes = useStore((state) => state.hiddenTickAxes);
  const toggleTickAxis = useStore((state) => state.toggleTickAxis);
  // Scaling mode + custom bounds + their setters, and the current
  // gridSpace (read for the custom inputs' placeholders, which show the
  // active ± bound each axis is currently using) — drive the Grid page's
  // scaling controls.
  const tickDensity = useStore((state) => state.tickDensity);
  const setTickDensity = useStore((state) => state.setTickDensity);
  const scalingMode = useStore((state) => state.scalingMode);
  const setScalingMode = useStore((state) => state.setScalingMode);
  const customBounds = useStore((state) => state.customBounds);
  const setCustomBound = useStore((state) => state.setCustomBound);
  const displayRange = useStore((state) => state.gridSpace.DISPLAY_RANGE);
  // Current isolated octant + setter — drives the Isolate page's gizmo,
  // its status line, and the icon-strip button's active state.
  const isolatedOctant = useStore((state) => state.isolatedOctant);
  const setIsolatedOctant = useStore((state) => state.setIsolatedOctant);
  // Which page (if any) is currently selected. null means the panel
  // is fully collapsed — only the icon strip shows, no content pane.
  const [activePage, setActivePage] = useState<PageKey | null>(null);
  // Width of the content pane in pixels. Kept as a SEPARATE piece of
  // state from activePage (rather than deriving one from the other)
  // because they're set together but for different reasons: clicking
  // a page icon sets both at once (see togglePage), while dragging
  // the resize border only ever changes contentWidth. Two independent
  // pieces of state that are kept in sync by the functions below is
  // simpler here than trying to derive one from the other, since
  // "open at a specific dragged width" and "open at the default
  // width" are both valid states contentWidth needs to represent.
  const [contentWidth, setContentWidth] = useState(0);
  // Whether a resize drag is currently in progress. A ref (not
  // useState) because it's read inside the pointermove hot path on
  // every pointer movement — using state there would be needless churn.
  const isResizing = useRef(false);
  // A SECOND, render-affecting flag for the same "is dragging" fact,
  // used only to toggle the content pane's width transition (below).
  // The pane keeps its 150ms width transition for smooth click
  // open/close, but that transition must be OFF during a live drag —
  // otherwise the width eases toward the cursor over 150ms instead of
  // tracking it 1:1, which reads as laggy, chunky resizing. This is
  // state (not the ref above) because the className depends on it, so
  // it has to trigger a re-render; it only flips twice per drag
  // (start/end), so the cost is negligible.
  const [isDragging, setIsDragging] = useState(false);
  // The content width as of the latest pointermove during a drag. Kept
  // as a ref (updated alongside setContentWidth) so handleResizeEnd can
  // read the final dragged width synchronously to decide how to settle
  // — reading `contentWidth` state there would see a stale value, since
  // the last setContentWidth of the drag may not have committed yet.
  const latestWidth = useRef(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    // Reset value so selecting the SAME file again still fires onChange.
    e.target.value = "";
  };

  // Clicking a page icon: if that page is already open, close the
  // panel entirely (width -> 0, activePage -> null); otherwise switch
  // to it. When switching to a DIFFERENT page while the panel is
  // already open, the current width is preserved rather than reset
  // to DEFAULT_OPEN_WIDTH — respects a width the user may have
  // manually dragged, so swapping between Data and Grid doesn't
  // undo their resize.
  const togglePage = (page: PageKey) => {
    if (activePage === page) {
      setActivePage(null);
      setContentWidth(0);
    } else {
      setActivePage(page);
      setContentWidth((w) => (w > 0 ? w : DEFAULT_OPEN_WIDTH));
    }
  };

  // Starts a resize drag. setPointerCapture ensures this element keeps
  // receiving pointermove/pointerup events even if the cursor moves
  // faster than the border and briefly ends up outside its thin hit
  // area — without it, a fast drag could "lose" the pointer mid-move.
  // If the panel is fully collapsed (no page selected) when a drag
  // starts, default to the Data page so there's something to see
  // while resizing, rather than dragging open an empty content pane.
  const handleResizeStart = (e: React.PointerEvent) => {
    // Suppress the browser's native text-selection gesture that a
    // click-and-drag otherwise triggers — without this, dragging the
    // handle sweeps a text selection across the HUD text elsewhere on
    // the page. preventDefault cancels it at the source; setting
    // body user-select to none is the cross-browser belt-and-suspenders,
    // since selection is a document-level gesture that pointer capture
    // (below) does nothing about. Both are undone in handleResizeEnd.
    e.preventDefault();
    document.body.style.userSelect = "none";
    isResizing.current = true;
    setIsDragging(true);
    // Seed latestWidth with the current width, so a click on the handle
    // with no actual movement settles to where it already was (a no-op)
    // rather than acting on a stale value from a previous drag.
    latestWidth.current = contentWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!activePage) setActivePage("data");
  };

  // Converts the cursor's current screen position into a content pane
  // width. Since the whole panel is docked against the RIGHT edge of
  // the screen, "distance from the right edge" is the panel's total
  // width at the cursor's position. Subtracting ICON_STRIP_WIDTH from
  // that removes the icon strip's own fixed-width space, leaving just
  // the content pane's width — i.e. the icon strip's position never
  // moves, only contentWidth (and therefore the content pane's outer
  // edge) tracks the cursor.
  //
  // The width tracks the cursor CONTINUOUSLY all the way down to 0 (no
  // minimum-width clamp, no snap-to-closed) so the motion stays smooth
  // and fully reversible as you approach the right edge — drag in and it
  // shrinks to nothing, drag back out and it grows again. activePage is
  // deliberately NOT cleared here mid-drag: the page content is hidden
  // purely by the `contentWidth > 0` render guard, so a near-closed pane
  // dragged back open shows its content again without losing the
  // selection. The decision to actually finish closing vs. settle at a
  // minimum width is deferred to release (handleResizeEnd).
  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing.current) return;
    const distanceFromRightEdge = window.innerWidth - e.clientX;
    const newWidth = distanceFromRightEdge - ICON_STRIP_WIDTH;
    const clamped = Math.max(0, Math.min(MAX_OPEN_WIDTH, newWidth));
    latestWidth.current = clamped;
    setContentWidth(clamped);
  }, []);

  const handleResizeEnd = () => {
    // Ignore pointerups that aren't ending an actual resize drag (e.g. a
    // click that bubbled up from an icon button), so we don't re-settle
    // the pane's width on unrelated interactions.
    if (!isResizing.current) return;
    isResizing.current = false;
    // Re-enable the width transition (isDragging -> false) BEFORE the
    // settle setState below, so that whichever way the pane settles —
    // closing to 0, or snapping up to MIN_OPEN_WIDTH — it animates
    // smoothly instead of jumping. Both settles run in this same handler,
    // so React batches them into one re-render with the transition on.
    setIsDragging(false);
    // Restore normal text selection now the drag is over (see
    // handleResizeStart for why it was disabled).
    document.body.style.userSelect = "";

    const finalWidth = latestWidth.current;
    if (finalWidth < CLOSE_THRESHOLD) {
      // Released near the edge — finish closing.
      setContentWidth(0);
      setActivePage(null);
    } else if (finalWidth < MIN_OPEN_WIDTH) {
      // Released open but too narrow to be useful — settle up to the
      // minimum usable width rather than leaving a cramped sliver.
      setContentWidth(MIN_OPEN_WIDTH);
    }
    // Otherwise keep whatever width the drag ended on.
  };

  // Shared styling for an icon-strip button. `active` gets a brighter
  // fill — used for the grid-visibility toggle (active = grid is
  // currently shown) and for page tabs (active = that page is the
  // currently open one). Action-only buttons (load CSV, reset pivot)
  // never pass true here, since clicking them does something
  // immediately rather than entering a persistent "selected" state.
  const iconButtonClass = (active: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded transition-colors ${
      active ? ICON_BUTTON.active : ICON_BUTTON.idle
    }`;

  return (
    // Outer wrapper spans the full viewport height and is pinned to
    // the screen's top-right corner (fixed top-0 right-0). z-20 is
    // required here — without an explicit z-index, React Three
    // Fiber's <Canvas> wrapper div (rendered later in App.tsx's JSX,
    // and itself position:relative by default) paints on top of this
    // panel despite looking visually similar, silently swallowing all
    // clicks meant for the toolbar. z-20 keeps this above the HUD
    // overlay's z-10 (see App.tsx) and above the Canvas.
    <div
      className="pointer-events-auto fixed top-0 right-0 z-20 flex h-screen"
      onPointerMove={handleResizeMove}
      onPointerUp={handleResizeEnd}
    >
      {/* Resize handle — sits on the icon strip's viewport-facing
          edge, matching Blender's panel-border drag target. Kept as a
          thin (1px visible, easily-clickable via padding-less hit
          area) strip that brightens on hover to signal it's
          draggable. */}
      <div
        onPointerDown={handleResizeStart}
        className="w-1 cursor-ew-resize bg-white/5 hover:bg-blue-500/50 transition-colors"
        title="Drag to resize"
      />

      {/* Icon strip — FIXED width (ICON_STRIP_WIDTH), always visible,
          never moves regardless of contentWidth. Sits immediately
          after the resize border, before the content pane — matching
          Blender's Properties editor, where the tab icons stay
          pinned next to the viewport while only the content area
          resizes. */}
      <div
        className={`flex flex-col items-center gap-1 p-1.5 pt-4 ${PANEL.bg}`}
        style={{ width: ICON_STRIP_WIDTH }}
      >
        {/* Hidden native file input, triggered by the visible
            paperclip button below. accept is a UI hint only —
            parseCSV.ts still validates actual file content, since
            accept can be bypassed (e.g. drag-and-drop, renamed files). */}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ACTION: toggle dark/light mode. Icon reflects the CURRENT
            mode (Moon while dark, Sun while light) — same convention
            as Eye/EyeOff and Hand/MousePointer2 below. Lit (active
            styling) specifically while in LIGHT mode, since dark is
            the app's default — mirrors how the pan tool only lights
            up for its non-default state, rather than lighting up for
            whichever boolean happens to be true. */}
        <button
          onClick={toggleDarkMode}
          className={iconButtonClass(!darkMode)}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* ACTION: load CSV */}
        <button
          onClick={() => inputRef.current?.click()}
          className={iconButtonClass(false)}
          title="Load CSV"
        >
          <Paperclip size={16} />
        </button>

        {/* ACTION: reset pivot to origin. Consolidated here from the
            old inline "Reset Pivot" button that used to live in
            App.tsx's bottom HUD control guide — moved to keep all
            toolbar-style actions in one place rather than duplicated
            across two UI locations. */}
        <button
          onClick={() => setPivot([0, 0, 0])}
          className={iconButtonClass(false)}
          title="Reset pivot to origin"
        >
          <RotateCcw size={16} />
        </button>

        {/* Grid visibility now lives in the Grid page ("Show grid"
            checkbox) alongside the rest of the grid settings, rather
            than as a separate icon-strip button. */}

        {/* ACTION: toggle mouse-drag mode between orbit (rotate) and
            pan (translate). Active state reflects which mode is
            currently selected — "pan" lights up the hand icon; the
            default "orbit" mode has no dedicated lit icon here, since
            orbit is the baseline/original behavior, not a toggle-on
            feature. See CameraRig.tsx for the actual drag handler,
            and App.tsx where activeTool gates OrbitControls'
            enableRotate. */}
        <button
          onClick={() => setActiveTool(activeTool === "pan" ? "orbit" : "pan")}
          className={iconButtonClass(activeTool === "pan")}
          title={
            activeTool === "pan"
              ? "Switch to orbit (rotate)"
              : "Switch to pan (drag to move view)"
          }
        >
          {activeTool === "pan" ? (
            <Hand size={16} />
          ) : (
            <MousePointer2 size={16} />
          )}
        </button>

        <div className={`w-full h-[1px] my-1 ${PANEL.divider}`} />

        {/* PAGE: Data. Active state checks BOTH activePage === "data"
            AND contentWidth > 0 — not just activePage alone — because
            activePage can technically still hold "data" for a brief
            moment during the close animation (see togglePage) while
            contentWidth is already animating down to 0; checking both
            keeps the button's highlighted state in sync with what's
            actually visible on screen, not just the logical selection. */}
        <button
          onClick={() => togglePage("data")}
          className={iconButtonClass(activePage === "data" && contentWidth > 0)}
          title="Data"
        >
          <Database size={16} />
        </button>

        {/* PAGE: Grid — same active-state logic as Data above. */}
        <button
          onClick={() => togglePage("grid")}
          className={iconButtonClass(activePage === "grid" && contentWidth > 0)}
          title="Grid"
        >
          <Grid3x3 size={16} />
        </button>

        {/* PAGE: Isolate — the octant gizmo. Lit as active either when the
            page is open OR whenever an octant is currently isolated, so an
            active isolation stays visible in the strip with the panel shut
            (otherwise a filtered-looking grid would have no on-screen
            explanation). */}
        <button
          onClick={() => togglePage("isolate")}
          className={iconButtonClass(
            (activePage === "isolate" && contentWidth > 0) ||
              isolatedOctant !== null,
          )}
          title="Isolate quadrant"
        >
          <Box size={16} />
        </button>
      </div>

      {/* Content pane — sits AFTER the icon strip, extending toward
          the screen's right edge. The wrapper div always exists (even
          at width 0) rather than being conditionally rendered, so
          that the `transition-[width]` class can animate it smoothly
          open/closed instead of the content just popping in and out
          instantly. */}
      <div
        className={`${PANEL.bg} border-l ${PANEL.border} overflow-hidden ${
          isDragging ? "" : "transition-[width] duration-150"
        }`}
        style={{ width: contentWidth }}
      >
        {/* Actual page content only renders once the pane has real
            width — avoids rendering (and users tabbing into) content
            that's currently invisible/mid-collapse. */}
        {activePage && contentWidth > 0 && (
          <div className="w-56 p-3 pt-4 space-y-3">
            {/* Data page: lists the two features planned to live here
                (filtering, point-size scaling) as named placeholders
                rather than generic "coming soon" text, so it's clear
                what's actually planned versus just a stub. Filtering
                is tracked under issue #27; point-size scaling doesn't
                have its own issue yet — see whichever issue ends up
                covering large-dataset rendering work (e.g. #26). */}
            {activePage === "data" && (
              <>
                <p className={TEXT.heading}>Data</p>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold ${TEXT.body}`}>
                      Filters
                    </p>
                    {(hiddenClasses.length > 0 ||
                      numericFilters.x.op !== "off" ||
                      numericFilters.y.op !== "off" ||
                      numericFilters.z.op !== "off") && (
                      <button
                        onClick={clearFilters}
                        className={`text-[9px] ${LINK.base}`}
                        title="Clear all filters"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Class visibility: one toggle per class present in the
                      dataset. Clicking hides/shows that class's points. */}
                  <p className={`${TEXT.subtle} mb-1`}>Classes</p>
                  <div className="space-y-0.5 mb-2">
                    {availableClasses.map((className) => {
                      const hidden = hiddenClasses.includes(className);
                      return (
                        <button
                          key={className}
                          onClick={() => toggleClassHidden(className)}
                          className={`w-full flex items-center gap-2 px-1 py-0.5 rounded ${HOVER.subtle} transition-colors ${
                            hidden ? "opacity-40" : ""
                          }`}
                          title={hidden ? "Show class" : "Hide class"}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor:
                                classColors[className] || DEFAULT_CLASS_COLOR,
                            }}
                          />
                          <span
                            className={`text-[10px] ${TEXT.emphasis} flex-1 text-left truncate`}
                          >
                            {className}
                          </span>
                          {hidden ? (
                            <EyeOff size={11} className={TEXT.muted} />
                          ) : (
                            <Eye size={11} className={TEXT.iconDefault} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Numeric filters: one operator dropdown + value box
                      per axis, comparing the point's RAW value on that
                      axis (matching the axis tick labels). */}
                  <p className={`${TEXT.subtle} mb-1`}>Value</p>
                  <div className="space-y-1">
                    {(["x", "y", "z"] as AxisKey[]).map((axis) => {
                      const f = numericFilters[axis];
                      return (
                        <div key={axis} className="flex items-center gap-1">
                          <span
                            className={`text-[9px] font-mono ${TEXT.muted} w-14 truncate shrink-0`}
                            title={axisLabels[axis]}
                          >
                            {axisLabels[axis]}
                          </span>
                          <select
                            value={f.op}
                            onChange={(e) =>
                              setNumericFilter(axis, {
                                ...f,
                                op: e.target.value as FilterOp,
                              })
                            }
                            className={`${INPUT.base} text-[10px] rounded px-1 py-0.5 shrink-0`}
                            aria-label={`${axisLabels[axis]} operator`}
                          >
                            {FILTER_OPS.map((o) => (
                              <option
                                key={o.value}
                                value={o.value}
                                className={INPUT.optionBg}
                              >
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {f.op === "between" ? (
                            // Range mode: two boxes (min / max). Either
                            // left blank acts as a single-sided bound —
                            // see passesNumeric in PointCloud.tsx.
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <input
                                type="number"
                                value={f.value}
                                placeholder="min"
                                onChange={(e) =>
                                  setNumericFilter(axis, {
                                    ...f,
                                    value: e.target.value,
                                  })
                                }
                                className={`${INPUT.base} text-[10px] rounded px-1 py-0.5 w-full min-w-0 font-mono`}
                                aria-label={`${axisLabels[axis]} min`}
                              />
                              <span
                                className={`${TEXT.faint} text-[9px] shrink-0`}
                              >
                                –
                              </span>
                              <input
                                type="number"
                                value={f.value2}
                                placeholder="max"
                                onChange={(e) =>
                                  setNumericFilter(axis, {
                                    ...f,
                                    value2: e.target.value,
                                  })
                                }
                                className={`${INPUT.base} text-[10px] rounded px-1 py-0.5 w-full min-w-0 font-mono`}
                                aria-label={`${axisLabels[axis]} max`}
                              />
                            </div>
                          ) : (
                            <input
                              type="number"
                              value={f.value}
                              disabled={f.op === "off"}
                              placeholder="value"
                              onChange={(e) =>
                                setNumericFilter(axis, {
                                  ...f,
                                  value: e.target.value,
                                })
                              }
                              className={`${INPUT.base} text-[10px] rounded px-1 py-0.5 w-full min-w-0 disabled:opacity-40 font-mono`}
                              aria-label={`${axisLabels[axis]} value`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold ${TEXT.body}`}>
                      Point size
                    </p>
                    <span
                      className={`text-[10px] font-mono ${TEXT.muted} tabular-nums`}
                    >
                      {pointSizeScale.toFixed(2)}×
                    </span>
                  </div>
                  {/* Multiplier on the auto-computed (count-based) point
                      radius — see PointCloud.tsx. 1× = automatic; drag
                      down to declutter dense clouds, up to emphasize
                      sparse data or make points easier to click. */}
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={pointSizeScale}
                    onChange={(e) =>
                      setPointSizeScale(parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                    aria-label="Point size"
                  />
                  <div
                    className={`flex justify-between text-[9px] ${TEXT.faint} mt-0.5`}
                  >
                    <span>Smaller</span>
                    <button
                      onClick={() => setPointSizeScale(1)}
                      className="hover:text-white/70 transition-colors"
                      title="Reset to automatic size"
                    >
                      Reset
                    </button>
                    <span>Larger</span>
                  </div>
                </div>
              </>
            )}
            {activePage === "grid" && (
              <>
                <p className={TEXT.heading}>Grid</p>
                {/* Grid visibility — moved here from the icon strip so all
                    grid settings live together on this page. */}
                <label
                  className={`flex items-center gap-2 text-[10px] ${TEXT.body} cursor-pointer`}
                >
                  <input
                    type="checkbox"
                    checked={gridVisible}
                    onChange={toggleGrid}
                    className="accent-blue-500"
                  />
                  Show grid
                </label>
                <div>
                  <p className={`text-[10px] font-bold ${TEXT.body} mb-1`}>
                    Tick labels
                  </p>
                  {(["x", "y", "z"] as const).map((axis) => (
                    <label
                      key={axis}
                      className={`flex items-center gap-2 text-[10px] ${TEXT.body} cursor-pointer mb-1`}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenTickAxes.includes(axis)}
                        onChange={() => toggleTickAxis(axis)}
                        className="accent-blue-500"
                      />
                      {axisLabels[axis]}
                    </label>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold ${TEXT.body}`}>
                      Tick density
                    </p>
                    <span
                      className={`text-[10px] font-mono ${TEXT.muted} tabular-nums`}
                    >
                      {tickDensity}/side
                    </span>
                  </div>
                  {/* Target tick marks per side; Axes.tsx nice-rounds the
                      step to roughly hit it. Higher = finer/more ticks. */}
                  <input
                    type="range"
                    min={3}
                    max={30}
                    step={1}
                    value={tickDensity}
                    onChange={(e) =>
                      setTickDensity(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                    aria-label="Tick density"
                  />
                  <div
                    className={`flex justify-between text-[9px] ${TEXT.faint} mt-0.5`}
                  >
                    <span>Coarse</span>
                    <span>Fine</span>
                  </div>
                </div>
                <div>
                  <p className={`text-[10px] font-bold ${TEXT.body} mb-1`}>
                    Scaling
                  </p>
                  {SCALING_MODES.map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-start gap-2 text-[10px] ${TEXT.body} cursor-pointer mb-1`}
                    >
                      <input
                        type="radio"
                        name="scaling-mode"
                        checked={scalingMode === m.value}
                        onChange={() => setScalingMode(m.value)}
                        className="accent-blue-500 mt-0.5"
                      />
                      <span>
                        {m.label}
                        <span className={`block text-[9px] ${TEXT.faint}`}>
                          {m.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                  {/* Custom ± bounds per axis — only shown in custom mode.
                      Placeholder shows the axis's current bound (the auto
                      value when left blank). Typing recomputes the grid
                      live. */}
                  {scalingMode === "custom" && (
                    <div className="mt-1 space-y-1">
                      {(["x", "y", "z"] as AxisKey[]).map((axis) => (
                        <div key={axis} className="flex items-center gap-1">
                          <span
                            className={`text-[9px] font-mono ${TEXT.muted} w-14 truncate shrink-0`}
                            title={axisLabels[axis]}
                          >
                            {axisLabels[axis]}
                          </span>
                          <span className={`text-[9px] ${TEXT.faint} shrink-0`}>
                            ±
                          </span>
                          <input
                            type="number"
                            value={customBounds[axis]}
                            placeholder={String(
                              Math.max(
                                Math.abs(displayRange[axis].min),
                                Math.abs(displayRange[axis].max),
                              ),
                            )}
                            onChange={(e) =>
                              setCustomBound(axis, e.target.value)
                            }
                            className={`${INPUT.base} text-[10px] rounded px-1 py-0.5 w-full min-w-0 font-mono`}
                            aria-label={`${axisLabels[axis]} bound`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {activePage === "isolate" && (
              <>
                <p className={TEXT.heading}>Isolate</p>
                <p className={`text-[10px] ${TEXT.muted}`}>
                  Click a cube to isolate that corner of the grid. Click inside
                  the outline but off the cubes to show everything again.
                </p>
                {/* The gizmo mirrors the main view's rotation, so the cube
                    you click is the corner sitting in that same on-screen
                    position. */}
                <OctantGizmo />
                <div className="flex items-start justify-between gap-2">
                  {/* Names the isolated corner by axis rather than by
                      initial — real column names often share a first
                      letter (invel_pps / invel_bpp both give "I"), which
                      made an abbreviated form ambiguous. */}
                  <div
                    className={`text-[10px] ${TEXT.muted} font-mono min-w-0`}
                  >
                    {isolatedOctant ? (
                      ([" x", "y", "z"] as const).map((_, i) => {
                        const label = [
                          axisLabels.x,
                          axisLabels.y,
                          axisLabels.z,
                        ][i];
                        return (
                          <div key={label} className="truncate">
                            {isolatedOctant[i] > 0 ? "+" : "−"} {label}
                          </div>
                        );
                      })
                    ) : (
                      <span>Showing all</span>
                    )}
                  </div>
                  {isolatedOctant && (
                    <button
                      onClick={() => setIsolatedOctant(null)}
                      className={`text-[9px] ${LINK.base} shrink-0`}
                      title="Show the full grid"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
