import Papa from "papaparse";
import { colorFileRules, normalizeHeader, config } from "./config";
import { appError, CODES } from "./errorCodes";
import { distinctReasons, type SkippedRow } from "./parseCSV";

/**
 * Parses a color-mapping file used to override the deterministic
 * generated colors in lib/classColors.ts. Per Charles's original
 * spec: "a class name and then a color code that allows the colors
 * to be set and changed from that file."
 *
 * Deliberately simpler than parseCSV.ts — no numeric/text sampling
 * needed. Extra columns beyond the two it looks for are simply
 * ignored rather than causing a rejection — there's no "exactly 2
 * columns" check.
 *
 * WHICH HEADERS COUNT: driven by config.json's
 * data.colorFile.classNameHeaders / colorHeaders, matched
 * case-insensitively and ignoring spaces, underscores, and hyphens
 * (see config.ts's normalizeHeader). Accepting another spelling is a
 * one-line edit to that file — no regex surgery here. Likewise, the
 * accepted color format is data.colorFile.colorPattern.
 */
export interface ColorMapResult {
  overrides: Record<string, string>;
  // Rows excluded, each with the reason — same shape and rationale as
  // parseCSV's skip list, so the Console renders both identically.
  skippedRows: SkippedRow[];
}

export function parseColorsCSV(file: File): Promise<ColorMapResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const rows = results.data;
        if (headers.length === 0 || rows.length === 0) {
          reject(
            appError(CODES.CLR_EMPTY, "Color file appears to be empty.", [
              `Headers found: ${headers.length}`,
              `Data rows found: ${rows.length}`,
            ]),
          );
          return;
        }
        // Accept any of the configured header spellings rather than
        // requiring an exact match — analysts editing this file by hand
        // shouldn't have to remember a precise column name.
        const classHeader = headers.find((h) =>
          colorFileRules.classNameHeaders.has(normalizeHeader(h)),
        );
        const colorHeader = headers.find((h) =>
          colorFileRules.colorHeaders.has(normalizeHeader(h)),
        );
        if (!classHeader || !colorHeader) {
          // Name the accepted spellings in the error, so a mismatched
          // file tells the analyst what this deployment actually wants
          // instead of a fixed example that may not match config.json.
          const classNames = [...colorFileRules.classNameHeaders].join(", ");
          const colorNames = [...colorFileRules.colorHeaders].join(", ");
          reject(
            appError(
              CODES.CLR_MISSING_HEADERS,
              "Color file needs a class-name column and a color column.",
              [
                `Found headers: ${headers.join(", ")}`,
                `Accepted class-name columns: ${classNames}`,
                `Accepted color columns: ${colorNames}`,
                "Matching ignores case, spaces, underscores, and hyphens.",
              ],
            ),
          );
          return;
        }
        const overrides: Record<string, string> = {};
        const skippedRows: SkippedRow[] = [];
        rows.forEach((row, index) => {
          const className = row[classHeader]?.trim();
          const color = row[colorHeader]?.trim();
          // Name the specific problem per row rather than lumping all
          // three causes together — "not a valid color" and "no class
          // name" call for completely different fixes.
          const skip = (reason: string) =>
            skippedRows.push({ row: index + 2, reason });
          if (!className) return skip(`${classHeader} is empty`);
          if (!color) return skip(`${colorHeader} is empty`);
          if (!colorFileRules.colorPattern.test(color)) {
            return skip(
              `"${color}" is not a valid color (expected ${config.data.colorFile.colorPattern})`,
            );
          }
          overrides[className] = color;
        });
        if (Object.keys(overrides).length === 0) {
          reject(
            appError(
              CODES.CLR_NO_VALID_PAIRS,
              `No usable class/color pairs — all ${rows.length} row(s) were excluded.`,
              distinctReasons(skippedRows),
            ),
          );
          return;
        }
        resolve({ overrides, skippedRows });
      },
      error: (error) =>
        reject(
          appError(
            CODES.CLR_PARSE_FAILED,
            error instanceof Error
              ? error.message
              : "The color file could not be read.",
          ),
        ),
    });
  });
}
