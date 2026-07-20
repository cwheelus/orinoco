import Papa from "papaparse";
import type { DataPoint } from "../types";

/**
 * parseCSV.ts
 *
 * Parses an arbitrary CSV file WITHOUT assuming fixed column names.
 * The current sample file happens to use uid/class/orig_bytes/
 * invel_pps/invel_bpp, but the spec calls for the app to be "easy to
 * interface with other external functions (select new data columns)"
 * — meaning any analyst's CSV, with any column names, should work.
 *
 * STRATEGY:
 * 1. Parse the file generically, reading whatever headers exist.
 * 2. Classify each column as NUMERIC or TEXT by sampling its values.
 * 3. Auto-detect likely roles from that classification:
 *    - Exactly 3 numeric columns -> those become x/y/z, IN HEADER
 *      ORDER. This is a real, known limitation: if a CSV's numeric
 *      columns aren't already in a meaningful left-to-right order,
 *      there's no way for this function to know which one "should"
 *      be X vs Y vs Z. A manual column-picker UI would resolve this,
 *      but isn't built yet — tracked as follow-up work, not silently
 *      assumed to be correct here.
 *    - Among text columns: the one with the most unique values
 *      (closer to one-per-row) is guessed as the uid; the remaining
 *      text column, if any, is guessed as the class/label. Any
 *      further text columns beyond these two are currently ignored —
 *      also a known constraint, not a silent bug.
 * 4. Return both the parsed points AND the detected column mapping,
 *    so the caller can show the user which real column became X, Y,
 *    Z, uid, and class, rather than that being an invisible guess.
 *
 * If auto-detection can't confidently find exactly 3 numeric + at
 * least 1 text column, parsing fails with a clear error rather than
 * guessing wrong silently.
 */

export interface ColumnMapping {
  uid: string;
  className: string;
  x: string;
  y: string;
  z: string;
}

export interface ParseResult {
  points: DataPoint[];
  mapping: ColumnMapping;
  // Row numbers (matching what a user would see in a spreadsheet,
  // 1-indexed + header row) skipped due to non-numeric values in a
  // column that was otherwise classified as numeric.
  skippedRows: number[];
}

// A column is treated as NUMERIC if at least this fraction of its
// non-empty sampled values parse as a valid number. Not 100%, since a
// real-world CSV may have a few blank/typo'd cells in an otherwise
// numeric column — those individual rows get skipped later, not the
// whole column's classification.
const NUMERIC_THRESHOLD = 0.9;
// How many rows to sample when classifying a column's type. Sampling
// instead of scanning the whole file keeps classification fast even
// on very large CSVs, since this only needs to be "confident enough,"
// not exhaustive.
const SAMPLE_SIZE = 50;

function isNumeric(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

function classifyColumns(
  headers: string[],
  rows: Record<string, string>[],
): { numeric: string[]; text: string[] } {
  const sample = rows.slice(0, SAMPLE_SIZE);
  const numeric: string[] = [];
  const text: string[] = [];

  for (const header of headers) {
    const values = sample
      .map((row) => row[header])
      .filter((v) => v !== undefined && v.trim() !== "");
    if (values.length === 0) {
      text.push(header); // no data to judge by; default to text
      continue;
    }
    const numericCount = values.filter(isNumeric).length;
    if (numericCount / values.length >= NUMERIC_THRESHOLD) {
      numeric.push(header);
    } else {
      text.push(header);
    }
  }

  return { numeric, text };
}

// Among candidate text columns, picks the one whose values are most
// often unique (closest to one distinct value per row) as the uid
// column — an identifier column should rarely repeat, unlike a class/
// label column which by definition repeats across many rows.
function pickUidColumn(
  candidates: string[],
  rows: Record<string, string>[],
): string {
  let best = candidates[0];
  let bestRatio = -1;
  for (const col of candidates) {
    const values = rows.map((r) => r[col]).filter(Boolean);
    const uniqueRatio = new Set(values).size / values.length;
    if (uniqueRatio > bestRatio) {
      bestRatio = uniqueRatio;
      best = col;
    }
  }
  return best;
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const rows = results.data;

        if (headers.length === 0 || rows.length === 0) {
          reject(new Error("CSV appears to be empty."));
          return;
        }

        const { numeric, text } = classifyColumns(headers, rows);

        // Need exactly 3 numeric columns to plot as x/y/z, per the
        // spec's 3D constraint (a 3D plot can't show more or fewer
        // axes). More or fewer than 3 means we can't confidently
        // auto-map without the user picking which 3 to use.
        if (numeric.length !== 3) {
          reject(
            new Error(
              `Expected exactly 3 numeric columns to plot, found ${numeric.length} (${numeric.join(", ") || "none"}). ` +
                `This CSV needs manual column selection, which isn't supported yet.`,
            ),
          );
          return;
        }

        if (text.length === 0) {
          reject(
            new Error(
              "No text/label columns found — need at least one for classification.",
            ),
          );
          return;
        }

        // uid: whichever text column has the highest ratio of unique
        // values. className: the remaining text column, if there is
        // one; if there's only one text column total, it's used for
        // BOTH roles rather than failing outright.
        const uidColumn = pickUidColumn(text, rows);
        const classColumn = text.find((c) => c !== uidColumn) ?? uidColumn;

        const [xCol, yCol, zCol] = numeric;

        const mapping: ColumnMapping = {
          uid: uidColumn,
          className: classColumn,
          x: xCol,
          y: yCol,
          z: zCol,
        };

        const points: DataPoint[] = [];
        const skippedRows: number[] = [];

        rows.forEach((row, index) => {
          const x = Number(row[xCol]);
          const y = Number(row[yCol]);
          const z = Number(row[zCol]);
          const uid = row[uidColumn]?.trim();
          const className = row[classColumn]?.trim();

          const isValid =
            uid &&
            className &&
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(z);

          if (!isValid) {
            skippedRows.push(index + 2); // +2: 1-indexed + header row
            return;
          }

          points.push({ uid, x, y, z, className });
        });

        if (points.length === 0) {
          reject(
            new Error(
              "No valid data rows found after parsing — check the file's contents.",
            ),
          );
          return;
        }

        resolve({ points, mapping, skippedRows });
      },
      error: (error) => reject(error),
    });
  });
}
