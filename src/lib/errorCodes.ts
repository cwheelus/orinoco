/**
 * errorCodes.ts
 *
 * The single registry of every diagnostic this app can report, and the
 * structured-error helpers that carry one out of a parser and into the
 * UI.
 *
 * WHY CODES: before this, every failure was a free-text string thrown
 * from wherever it happened. Two problems that caused — an analyst
 * reporting "it says it can't load my file" gave no way to tell which
 * of four different rejections fired, and the wording could not be
 * changed without invalidating whatever anyone had written down. A
 * stable code fixes both: CSV-002 is CSV-002 regardless of how its
 * sentence is phrased later.
 *
 * CODE FORMAT: <SUBSYSTEM>-<NUMBER>.
 *   CSV-0xx / CLR-0xx / CFG-0xx  errors     (the operation failed)
 *   ...-05x                       warnings  (it succeeded, imperfectly)
 *   ...-1xx                       info      (it succeeded)
 *
 * ADDING ONE: add an entry below and reference it at the throw site.
 * Codes are append-only — never renumber or reuse a retired code, since
 * the whole point is that a given number keeps meaning one thing.
 */

export type Severity = "error" | "warning" | "info";

export interface ErrorCode {
  /** Stable identifier shown in the UI, e.g. "CSV-002". Never reused. */
  readonly code: string;
  readonly severity: Severity;
  /** Short label for the console row and the banner heading. */
  readonly title: string;
}

export const CODES = {
  // --- Data CSV ingest -------------------------------------------------
  CSV_EMPTY: { code: "CSV-001", severity: "error", title: "Empty file" },
  CSV_TOO_FEW_NUMERIC: {
    code: "CSV-002",
    severity: "error",
    title: "Too few numeric columns",
  },
  CSV_NO_TEXT_COLUMNS: {
    code: "CSV-003",
    severity: "error",
    title: "No label column",
  },
  CSV_NO_VALID_ROWS: {
    code: "CSV-004",
    severity: "error",
    title: "No valid rows",
  },
  CSV_PARSE_FAILED: {
    code: "CSV-005",
    severity: "error",
    title: "Parse failed",
  },
  CSV_FETCH_FAILED: {
    code: "CSV-006",
    severity: "error",
    title: "Dataset fetch failed",
  },
  CSV_NOT_CSV: {
    code: "CSV-007",
    severity: "error",
    title: "Not a CSV file",
  },
  CSV_ROWS_SKIPPED: {
    code: "CSV-050",
    severity: "warning",
    title: "Rows excluded",
  },
  CSV_LOADED: { code: "CSV-100", severity: "info", title: "Dataset loaded" },
  CSV_REMAPPED: {
    code: "CSV-101",
    severity: "info",
    title: "Axis mapping changed",
  },

  // --- Color mapping file ----------------------------------------------
  CLR_EMPTY: { code: "CLR-001", severity: "error", title: "Empty color file" },
  CLR_MISSING_HEADERS: {
    code: "CLR-002",
    severity: "error",
    title: "Missing required columns",
  },
  CLR_NO_VALID_PAIRS: {
    code: "CLR-003",
    severity: "error",
    title: "No usable class/color pairs",
  },
  CLR_PARSE_FAILED: {
    code: "CLR-004",
    severity: "error",
    title: "Color file parse failed",
  },
  CLR_ROWS_SKIPPED: {
    code: "CLR-050",
    severity: "warning",
    title: "Color rows excluded",
  },
  CLR_LOADED: {
    code: "CLR-100",
    severity: "info",
    title: "Color mapping loaded",
  },

  // --- Catch-all --------------------------------------------------------
  // For a genuinely unexpected throw — something that isn't one of the
  // failures above. If this shows up in the console regularly, whatever
  // is producing it deserves its own code.
  APP_UNEXPECTED: {
    code: "APP-001",
    severity: "error",
    title: "Unexpected error",
  },
} as const satisfies Record<string, ErrorCode>;

/**
 * An Error carrying its registry entry and optional per-line detail.
 *
 * Built by a factory rather than a `class extends Error`, to match the
 * rest of this codebase (which has no classes) — and because subclassed
 * built-ins are a well-known source of instanceof breakage under
 * transpilation. A plain Error with fields attached keeps every existing
 * `err instanceof Error` check working unchanged.
 */
export interface AppError extends Error {
  readonly appCode: ErrorCode;
  /** Extra lines shown in the console but not in the compact banner. */
  readonly detail?: string[];
}

export function appError(
  appCode: ErrorCode,
  message: string,
  detail?: string[],
): AppError {
  const err = new Error(message) as Error & {
    appCode: ErrorCode;
    detail?: string[];
  };
  err.name = "AppError";
  err.appCode = appCode;
  err.detail = detail;
  return err;
}

export function isAppError(err: unknown): err is AppError {
  if (!(err instanceof Error) || err.name !== "AppError") return false;
  const appCode = (err as { appCode?: unknown }).appCode;
  return (
    typeof appCode === "object" &&
    appCode !== null &&
    typeof (appCode as ErrorCode).code === "string" &&
    typeof (appCode as ErrorCode).severity === "string" &&
    typeof (appCode as ErrorCode).title === "string"
  );
}

/**
 * Narrows an unknown caught value to { code, message } for logging.
 * Anything that isn't a coded AppError becomes APP_UNEXPECTED, so a
 * stray throw still lands in the console with a code rather than
 * vanishing or arriving as a bare string.
 */
export function describeError(
  err: unknown,
  fallbackMessage: string,
): {
  appCode: ErrorCode;
  message: string;
  detail?: string[];
} {
  if (isAppError(err)) {
    return { appCode: err.appCode, message: err.message, detail: err.detail };
  }
  return {
    appCode: CODES.APP_UNEXPECTED,
    message: err instanceof Error ? err.message : fallbackMessage,
  };
}
