import rawConfig from "../../config.json";

/**
 * config.ts
 *
 * Typed loader for /config.json — the single place a deployer or
 * maintainer can retune the app without reading component code.
 *
 * WHAT BELONGS IN config.json: values a site host might legitimately
 * need to change (ingest thresholds, accepted column names, point
 * sizing, grid extents, zoom limits, startup defaults). Things that
 * are algorithm rather than policy — FNV-1a's constants, niceStep's
 * 1/2/5 ladder, the HSL sector math in classColors.ts — stay in code,
 * because "configurable" there just means "breakable".
 *
 * HOW IT LOADS: Vite inlines config.json at build time, so edits need
 * a dev-server restart (or a rebuild) to take effect. That's the
 * deliberate trade: in exchange, TypeScript validates the file's shape
 * at compile time, so a typo'd key is a build error rather than an
 * undefined at runtime. `validate()` below covers the cases types
 * can't — values that are well-typed but nonsensical.
 *
 * Every consumer keeps its own named constants (`const BASE_RADIUS =
 * config.points.baseRadius`) rather than reaching into `config.*`
 * inline, so the code still reads in domain terms and each value keeps
 * the comment explaining what it does.
 */

export type ActiveToolName = "orbit" | "pan";
export type ScalingModeName = "normalized" | "real" | "custom";

export interface AppConfig {
  data: {
    /**
     * Dataset to load on startup.
     *
     * BLANK (the default) loads the CSV bundled at
     * sample-data/mixed-sign-sample.csv — i.e. current behavior.
     *
     * Set to a path or URL the browser can fetch (e.g.
     * "/data/flows.csv") to boot from that file instead. It is fetched
     * at startup and run through the same parseCSV pipeline as a
     * manual upload; a fetch or parse failure surfaces in the app's
     * normal CSV-load banner rather than failing silently.
     */
    sampleDataset: string;
    /** `accept` attribute for both file pickers. UI hint only — the parsers still validate content. */
    acceptedFileTypes: string;
    /** Fraction of a column's sampled non-empty cells that must parse as numbers for it to count as numeric. */
    numericThreshold: number;
    /** Rows sampled when classifying column types. Higher = more accurate on messy files, slower on huge ones. */
    typeSampleSize: number;
    /** Fewest numeric columns a file may have and still load. 2 plots as a flat plane (Z synthesized as 0). */
    minNumericColumns: number;
    colorFile: {
      /**
       * Header names accepted as the class-name column in a color-mapping
       * CSV. Matched case-insensitively and ignoring spaces, underscores,
       * and hyphens — so "className" also accepts "class name",
       * "Class_Name", etc. Add an entry to accept another spelling.
       */
      classNameHeaders: string[];
      /** Header names accepted as the color column. Same matching rules as above. */
      colorHeaders: string[];
      /**
       * Regex (as a string) a color cell must match to be accepted.
       * Defaults to 6-digit hex. Widen to
       * "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" to also allow
       * shorthand and alpha. Must compile — see validate() below.
       */
      colorPattern: string;
    };
  };

  grid: {
    /** Render-space extents of the reference box. The data range is mapped onto this, whatever its real units. */
    boxMin: number;
    boxMax: number;
    /** Spacing of the horizontal grid-plane lines, in render units. */
    planeStep: number;
    /** Headroom past the data's extremes before the wall, as a fraction. 0.1 = walls sit 10% beyond the farthest point. */
    rangeMargin: number;
    /** Opacity of the grid plane's lines and the bounding box's edges. */
    planeOpacity: number;
    boxOpacity: number;
  };

  points: {
    /** Point count at which the automatic radius equals baseRadius. Radius scales ~1/sqrt(count) from here. */
    referenceCount: number;
    baseRadius: number;
    /** Floor/ceiling on the AUTOMATIC radius, before the user's size slider is applied. */
    autoMinRadius: number;
    autoMaxRadius: number;
    /** Hard floor/ceiling on the FINAL radius, after the slider multiplier. */
    hardMinRadius: number;
    hardMaxRadius: number;
    /** Sphere tessellation. The main perf lever on very large datasets — 6 is noticeably cheaper, 16 noticeably smoother. */
    sphereSegments: number;
  };

  axes: {
    lineWidth: number;
    arrowLength: number;
    arrowRadius: number;
    /** Radial segments on the arrowhead cone. */
    arrowSegments: number;
    titleFontSize: number;
    /** Gap between the axis end and its column-name title. Raise it if long column names collide with the grid. */
    titlePadding: number;
    /** Camera distance at which ticks render at scale 1. Ticks are rescaled each frame to hold a constant on-screen size. */
    referenceDistance: number;
    labelFontSize: number;
    markLength: number;
    labelOffset: number;
    /** Extra offset applied only to the Y axis's tick numbers, which sit beside the axis rather than below it. */
    labelOffsetYExtra: number;
    /** Clamp on the per-frame tick scale, so ticks don't vanish or balloon at extreme zoom. */
    minScreenScale: number;
    maxScreenScale: number;
    /** Tick numbers at or above this magnitude, or below `exponentialBelow`, switch to scientific notation. */
    exponentialAbove: number;
    exponentialBelow: number;
    /** Decimal places on ordinary (non-scientific) tick numbers. */
    decimalPlaces: number;
  };

  camera: {
    /** Where the camera sits before any user input. */
    initialPosition: [number, number, number];
    /** Camera-to-pivot distance limits. Enforced for both scroll-wheel dolly and the W/S keys. */
    minZoomDistance: number;
    maxZoomDistance: number;
    /** How far the pivot may travel past the box walls, as a multiple of the box half-extent. */
    pivotLimitFactor: number;
    /** Movement rates, in units per second. */
    zoomSpeed: number;
    orbitSpeed: number;
    pivotSpeed: number;
    /** Pan calibration: worldUnits-per-pixel is `panSpeedAtReference` when the pivot is `panReferenceDistance` away. */
    panReferenceDistance: number;
    panSpeedAtReference: number;
  };

  defaults: {
    darkMode: boolean;
    gridVisible: boolean;
    activeTool: ActiveToolName;
    scalingMode: ScalingModeName;
    pointSizeScale: number;
    tickDensity: number;
    /** Axis names shown before the first dataset finishes loading. */
    axisLabels: { x: string; y: string; z: string };
    /** Label used for an axis with no column mapped to it (a 2D dataset's Z). */
    unmappedAxisLabel: string;
  };

  limits: {
    /** Range and granularity of the Data page's point-size slider. */
    pointSizeSlider: SliderLimits;
    /** Range and granularity of the Grid page's tick-density slider. */
    tickDensitySlider: SliderLimits;
  };

  console: {
    /**
     * How many diagnostics the Console page retains. Oldest are dropped
     * once full, so this bounds memory on a long session that loads
     * many files.
     */
    maxEntries: number;
    /**
     * How many individual excluded rows a single entry lists before
     * switching to a per-cause summary. Keeps one bad column in a
     * 50k-row file from rendering 50k lines.
     */
    maxListedRows: number;
  };
}

export interface SliderLimits {
  min: number;
  max: number;
  step: number;
}

// JSON modules widen string literals to `string` and tuples to arrays,
// so the assertion is needed to recover `ActiveToolName` and
// `[number, number, number]`. It still catches a missing or misspelled
// key, since neither type is assignable to the other in that case.
const config = rawConfig as AppConfig;

/**
 * Catches values that are the right TYPE but the wrong VALUE — the
 * failure mode TypeScript can't see and that would otherwise surface
 * as an invisible rendering bug (a NaN radius silently drops every
 * point; an inverted zoom range makes the camera unusable).
 *
 * Throws at module load, so a bad config fails loudly on first paint
 * rather than degrading somewhere deep in a frame loop.
 */
function validate(c: AppConfig): void {
  const problems: string[] = [];

  const positive = (path: string, v: number) => {
    if (!Number.isFinite(v) || v <= 0) {
      problems.push(`${path} must be a positive number (got ${v})`);
    }
  };
  const ordered = (path: string, lo: number, hi: number) => {
    if (!(lo < hi)) problems.push(`${path}: min must be less than max`);
  };

  const { data, grid, points, axes, camera, defaults, limits } = c;

  positive("console.maxEntries", c.console.maxEntries);
  positive("console.maxListedRows", c.console.maxListedRows);

  if (data.numericThreshold <= 0 || data.numericThreshold > 1) {
    problems.push("data.numericThreshold must be between 0 and 1");
  }
  positive("data.typeSampleSize", data.typeSampleSize);
  if (data.minNumericColumns < 2) {
    problems.push("data.minNumericColumns must be at least 2 — a plot needs two axes");
  }
  if (data.colorFile.classNameHeaders.length === 0) {
    problems.push("data.colorFile.classNameHeaders must list at least one header name");
  }
  if (data.colorFile.colorHeaders.length === 0) {
    problems.push("data.colorFile.colorHeaders must list at least one header name");
  }
  try {
    new RegExp(data.colorFile.colorPattern);
  } catch {
    problems.push(
      `data.colorFile.colorPattern is not a valid regular expression: ${data.colorFile.colorPattern}`,
    );
  }

  ordered("grid.boxMin/boxMax", grid.boxMin, grid.boxMax);
  positive("grid.planeStep", grid.planeStep);
  if (grid.rangeMargin < 0) problems.push("grid.rangeMargin cannot be negative");

  positive("points.referenceCount", points.referenceCount);
  positive("points.baseRadius", points.baseRadius);
  ordered("points.autoMinRadius/autoMaxRadius", points.autoMinRadius, points.autoMaxRadius);
  ordered("points.hardMinRadius/hardMaxRadius", points.hardMinRadius, points.hardMaxRadius);
  if (points.sphereSegments < 3) {
    problems.push("points.sphereSegments must be at least 3 to form a solid");
  }

  positive("axes.referenceDistance", axes.referenceDistance);
  ordered("axes.minScreenScale/maxScreenScale", axes.minScreenScale, axes.maxScreenScale);
  if (axes.decimalPlaces < 0) problems.push("axes.decimalPlaces cannot be negative");

  ordered("camera.minZoomDistance/maxZoomDistance", camera.minZoomDistance, camera.maxZoomDistance);
  positive("camera.minZoomDistance", camera.minZoomDistance);
  positive("camera.panReferenceDistance", camera.panReferenceDistance);

  if (camera.initialPosition.length !== 3) {
    problems.push("camera.initialPosition must have exactly 3 numbers [x, y, z]");
  }

  for (const [name, slider] of [
    ["limits.pointSizeSlider", limits.pointSizeSlider],
    ["limits.tickDensitySlider", limits.tickDensitySlider],
  ] as const) {
    ordered(name, slider.min, slider.max);
    positive(`${name}.step`, slider.step);
  }

  // A default outside its own slider's range would render the control
  // pinned to an end and unable to return to the configured value.
  const { min: psMin, max: psMax } = limits.pointSizeSlider;
  if (defaults.pointSizeScale < psMin || defaults.pointSizeScale > psMax) {
    problems.push(
      `defaults.pointSizeScale (${defaults.pointSizeScale}) is outside limits.pointSizeSlider [${psMin}, ${psMax}]`,
    );
  }
  const { min: tdMin, max: tdMax } = limits.tickDensitySlider;
  if (defaults.tickDensity < tdMin || defaults.tickDensity > tdMax) {
    problems.push(
      `defaults.tickDensity (${defaults.tickDensity}) is outside limits.tickDensitySlider [${tdMin}, ${tdMax}]`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid config.json:\n  - ${problems.join("\n  - ")}\n\nFix the values above and reload.`,
    );
  }
}

validate(config);

/**
 * Normalizes a CSV header for tolerant matching: case-insensitive, and
 * ignoring spaces, underscores, and hyphens. So a configured
 * "className" also accepts "class name", "Class_Name", and "class-name"
 * — analysts hand-editing a color file shouldn't have to reproduce an
 * exact spelling.
 */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, "");
}

/** Pre-normalized header sets + compiled color pattern, built once at load. */
export const colorFileRules = {
  classNameHeaders: new Set(
    config.data.colorFile.classNameHeaders.map(normalizeHeader),
  ),
  colorHeaders: new Set(config.data.colorFile.colorHeaders.map(normalizeHeader)),
  colorPattern: new RegExp(config.data.colorFile.colorPattern),
};

export { config };
