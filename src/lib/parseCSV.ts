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
 *    - 2 numeric columns -> treated as a 2D dataset, Z synthesized as 0.
 *    - 3+ numeric columns -> the first three (in header order) become
 *      the DEFAULT x/y/z. This is a real, known limitation: if a
 *      CSV's numeric columns aren't already in a meaningful
 *      left-to-right order, there's no way for this function to know
 *      which one "should" be X vs Y vs Z on its own. The analyst can
 *      override this default afterward via the Data panel's axis
 *      selectors, which call buildPoints() below directly against the
 *      retained rows — no reparse/re-upload needed. Any numeric
 *      columns beyond the chosen x/y/z are preserved in
 *      schema.numericColumns so they remain selectable.
 *    - Among text columns: the one with the most unique values
 *      (closer to one-per-row) is guessed as the uid; the remaining
 *      text column, if any, is guessed as the class/label. Any
 *      further text columns beyond these two are captured as
 *      metadata (see ParseResult.metadata) rather than ignored.
 * 4. Return both the parsed points AND the detected column mapping,
 *    so the caller can show the user which real column became X, Y,
 *    Z, uid, and class, rather than that being an invisible guess.
 *
 * If auto-detection can't confidently find at least 2 numeric + at
 * least 1 text column, parsing fails with a clear error rather than
 * guessing wrong silently.
 */

export interface ColumnMapping {
  uid: string;
  className: string;
  x: string;
  y: string;
  // Absent for a 2D dataset (2 numeric columns, or a manual selection
  // that leaves Z unset) — there is no Z column in that case. See
  // DatasetSchema.dimension for the authoritative signal of which
  // case the ORIGINAL parsed dataset was; a manually-remapped
  // dataset's actual dimensionality is just "mapping.z is set or not".
  z?: string;
}

export interface DatasetSchema {
  headers: string[];
  numericColumns: string[];
  textColumns: string[];
  uidColumn: string;
  classColumn: string;
  metadataColumns: string[];
  // 2 for a flat-plane dataset (2 numeric columns; Z synthesized as a
  // constant 0), 3 for a normal 3D dataset. Reflects the ORIGINAL
  // auto-detected shape of the file, not necessarily the current
  // mapping if the analyst has since picked a different set of axes
  // (e.g. choosing to leave Z unset on a 3+-numeric-column dataset,
  // which is a valid manual selection). Read by Axes.tsx to decide
  // whether to render the Z axis at all; when a manual mapping is
  // active, prefer checking mapping.z directly instead.
  dimension: 2 | 3;
}

export interface ParseResult {
  // Original parsed CSV rows retained so axis selections can be
  // changed without reparsing or re-uploading the dataset. See
  // useStore.ts's setColumnMapping, which calls buildPoints() again
  // against these same rows with a new ColumnMapping.
  rows: Record<string, string>[];

  points: DataPoint[];
  mapping: ColumnMapping;
  schema: DatasetSchema;
  // Non-numeric field values per point, keyed by uid — kept parallel
  // to `points` rather than merged into DataPoint, since DataPoint is
  // a lean rendering object read constantly by PointCloud.tsx. Only
  // covers schema.metadataColumns (text columns beyond uid/class).
  // If a dataset contains duplicate uid values, later rows will
  // overwrite earlier metadata entries for that uid — datasets are
  // expected to provide unique identifiers.
  metadata: Record<string, Record<string, string>>;
  // Row numbers (matching what a user would see in a spreadsheet,
  // 1-indexed + header row) skipped due to non-numeric values in a
  // column that was otherwise classified as numeric, or missing
  // uid/class values.
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

// Builds DataPoint[] (plus parallel metadata and a skipped-row list)
// from raw parsed rows against a given column mapping. Factored out
// of parseCSV so the exact same logic can rerun when the analyst
// changes which columns drive x/y/z, without reparsing the file or
// asking them to re-upload it — see useStore.ts's setColumnMapping,
// which is the other caller of this function besides parseCSV itself.
export function buildPoints(
  rows: Record<string, string>[],
  schema: DatasetSchema,
  mapping: ColumnMapping,
): {
  points: DataPoint[];
  metadata: Record<string, Record<string, string>>;
  skippedRows: number[];
} {
  const points: DataPoint[] = [];
  const skippedRows: number[] = [];
  const metadata: Record<string, Record<string, string>> = {};

  // No Z column in the mapping means this build should treat the
  // dataset as 2D, regardless of how many numeric columns the
  // ORIGINAL file had — this covers both the auto-detected 2-column
  // case and an analyst manually choosing to leave Z unset.
  const is2D = !mapping.z;
  // Hoisted out of the loop — the metadata column list itself never
  // changes per-row, only computed once.
  const metadataColumns = schema.metadataColumns;

  rows.forEach((row, index) => {
    const x = Number(row[mapping.x]);
    const y = Number(row[mapping.y]);
    const z = is2D ? 0 : Number(row[mapping.z!]);

    const uid = row[mapping.uid]?.trim();
    const className = row[mapping.className]?.trim();

    const isValid =
      uid &&
      className &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z);

    if (!isValid) {
      skippedRows.push(index + 2);
      return;
    }

    points.push({ uid, x, y, z, className });

    if (metadataColumns.length > 0) {
      metadata[uid] = Object.fromEntries(
        metadataColumns.map((col) => [col, row[col] ?? ""]),
      );
    }
  });

  return { points, metadata, skippedRows };
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

        // Need at least 2 numeric columns to visualize a dataset.
        // - 2 numeric columns: treated as a 2D dataset with Z synthesized as 0.
        // - 3 or more numeric columns: treated as a 3D dataset using the first
        //   three numeric columns (in header order) for x/y/z as the DEFAULT
        //   mapping. Additional numeric columns are preserved in
        //   schema.numericColumns; the analyst may override which columns
        //   drive x/y/z afterward via the Data panel — see useStore.ts's
        //   setColumnMapping, which rebuilds points via buildPoints above
        //   against the same retained rows, no reparse needed.
        if (numeric.length < 2) {
          reject(
            new Error(
              `Expected at least 2 numeric columns to plot, found ${numeric.length} (${numeric.join(", ") || "none"}).`,
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

        // Exactly two numeric columns represent a 2D dataset.
        // Z is synthesized as 0 for every point in that case.
        const is2D = numeric.length === 2;
        const schema: DatasetSchema = {
          headers,
          numericColumns: numeric,
          textColumns: text,
          uidColumn,
          classColumn,
          metadataColumns: text.filter(
            (c) => c !== uidColumn && c !== classColumn,
          ),
          dimension: is2D ? 2 : 3,
        };

        // Default mapping: first two/three numeric columns in header
        // order. The analyst may override this later via the Data
        // panel without needing to re-parse this file — see
        // useStore.ts's setColumnMapping.
        const [xCol, yCol, zCol] = numeric;
        const mapping: ColumnMapping = {
          uid: uidColumn,
          className: classColumn,
          x: xCol,
          y: yCol,
          z: zCol,
        };

        const { points, metadata, skippedRows } = buildPoints(
          rows,
          schema,
          mapping,
        );

        if (points.length === 0) {
          reject(
            new Error(
              "No valid data rows found after parsing — check the file's contents.",
            ),
          );
          return;
        }

        resolve({ rows, points, mapping, schema, metadata, skippedRows });
      },
      error: (error) => reject(error),
    });
  });
}
