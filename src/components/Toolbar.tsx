import { useRef, useState, useCallback } from "react";
import {
  Paperclip,
  Database,
  Grid3x3,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useStore } from "../store/useStore";

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
 * ICON STRIP CONTENTS:
 *  - Load CSV (action)
 *  - Reset pivot to origin (action)
 *  - Grid on/off (action, toggles gridVisible in the store — fully
 *    functional now, wired to CartesianGrid's render in App.tsx)
 *  - Data (page — houses filtering and data-size scaling once built;
 *    currently a placeholder, see issues #27 and future work)
 *  - Grid (page — houses multiple grid/scaling modes once built;
 *    currently a placeholder, see issues #25/#28)
 */
interface ToolbarProps {
  onFileSelected: (file: File) => void;
}

type PageKey = "data" | "grid";

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
// If a resize drag brings the content pane below this width, the
// panel snaps fully shut (width -> 0, activePage -> null) instead of
// floor-clamping at MIN_OPEN_WIDTH. Without this, dragging the border
// toward the icon strip could never actually close the panel — it
// would just stop at 120px and stay stuck open. This threshold is
// smaller than MIN_OPEN_WIDTH specifically so there's a small "dead
// zone" where continuing to drag closed genuinely closes it, rather
// than the panel oscillating between snapping shut and re-opening at
// the same cursor position.
const CLOSE_THRESHOLD = 60;

export function Toolbar({ onFileSelected }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setPivot = useStore((state) => state.setPivot);
  const gridVisible = useStore((state) => state.gridVisible);
  const toggleGrid = useStore((state) => state.toggleGrid);

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
  // useState) because it's only read inside the pointermove handler,
  // never rendered — using state here would trigger a re-render on
  // every single pointer movement during a drag, which isn't needed.
  const isResizing = useRef(false);

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
    isResizing.current = true;
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
  // Below CLOSE_THRESHOLD, the panel snaps fully shut (width 0,
  // activePage cleared) rather than clamping at MIN_OPEN_WIDTH — this
  // is what actually makes "drag the border closed" work as a real
  // way to close the panel, not just a way to shrink it to a minimum.
  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing.current) return;
    const distanceFromRightEdge = window.innerWidth - e.clientX;
    const newWidth = distanceFromRightEdge - ICON_STRIP_WIDTH;
    if (newWidth < CLOSE_THRESHOLD) {
      setContentWidth(0);
      setActivePage(null);
      return;
    }
    setContentWidth(
      Math.min(MAX_OPEN_WIDTH, Math.max(MIN_OPEN_WIDTH, newWidth)),
    );
  }, []);

  const handleResizeEnd = () => {
    isResizing.current = false;
  };

  // Shared styling for an icon-strip button. `active` gets a brighter
  // fill — used for the grid-visibility toggle (active = grid is
  // currently shown) and for page tabs (active = that page is the
  // currently open one). Action-only buttons (load CSV, reset pivot)
  // never pass true here, since clicking them does something
  // immediately rather than entering a persistent "selected" state.
  const iconButtonClass = (active: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded transition-colors ${
      active
        ? "bg-blue-500/40 text-white"
        : "text-white/50 hover:bg-white/10 hover:text-white"
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
        className="flex flex-col items-center gap-1 p-1.5 pt-4 bg-black/70 backdrop-blur-sm"
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

        {/* ACTION: toggle grid visibility — fully functional, wired
            to gridVisible in the store (see useStore.ts's toggleGrid
            and App.tsx's conditional <CartesianGrid /> render). Icon
            swaps between Eye/EyeOff to reflect current state, and the
            button itself lights up (active state) whenever the grid
            is currently shown, so its fill state doubles as a visual
            indicator without needing to read the icon closely. */}
        <button
          onClick={toggleGrid}
          className={iconButtonClass(gridVisible)}
          title={gridVisible ? "Hide grid" : "Show grid"}
        >
          {gridVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        <div className="w-full h-[1px] bg-white/10 my-1" />

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
      </div>

      {/* Content pane — sits AFTER the icon strip, extending toward
          the screen's right edge. The wrapper div always exists (even
          at width 0) rather than being conditionally rendered, so
          that the `transition-[width]` class can animate it smoothly
          open/closed instead of the content just popping in and out
          instantly. */}
      <div
        className="bg-black/70 backdrop-blur-sm border-l border-white/10 overflow-hidden transition-[width] duration-150"
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
                <p className="text-[10px] font-bold text-blue-400 uppercase">
                  Data
                </p>
                <div>
                  <p className="text-[10px] font-bold text-white/70 mb-0.5">
                    Filters
                  </p>
                  <p className="text-[10px] text-white/40">
                    Filter by classification and value range — coming soon.
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 mb-0.5">
                    Point size scaler
                  </p>
                  <p className="text-[10px] text-white/40">
                    Adjust rendered point size for dense datasets — coming soon.
                  </p>
                </div>
              </>
            )}
            {/* Grid page: alternate grid layouts (issue #28) and
                multiple axis-scaling modes (issue #25) — both are
                separate, already-tracked issues; this page is just
                their future UI home, not new scope for #16 itself. */}
            {activePage === "grid" && (
              <>
                <p className="text-[10px] font-bold text-blue-400 uppercase">
                  Grid
                </p>
                <div>
                  <p className="text-[10px] font-bold text-white/70 mb-0.5">
                    Grid modes
                  </p>
                  <p className="text-[10px] text-white/40">
                    Alternate grid layouts (e.g. axis-through-center) — coming
                    soon.
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 mb-0.5">
                    Scaling modes
                  </p>
                  <p className="text-[10px] text-white/40">
                    Switch between independent per-axis and uniform scaling —
                    coming soon.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
