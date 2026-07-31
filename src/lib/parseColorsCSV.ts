import Papa from "papaparse";

/**
 * Parses a color-mapping file used to override the deterministic
 * generated colors in lib/classColors.ts. Per Charles's original
 * spec: "a class name and then a color code that allows the colors
 * to be set and changed from that file."
 *
 * Deliberately simpler than parseCSV.ts — no numeric/text sampling
 * needed. Header matching is regex-based and case-insensitive
 * (className/class/name; color/colour/hex), so extra columns beyond
 * those two are simply ignored rather than causing a rejection —
 * there's no "exactly 2 columns" check.
 */
export interface ColorMapResult {
  overrides: Record<string, string>;
  // Row numbers (1-indexed + header) skipped for missing/invalid data.
  skippedRows: number[];
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function parseColorsCSV(file: File): Promise<ColorMapResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const rows = results.data;
        if (headers.length === 0 || rows.length === 0) {
          reject(new Error("Color file appears to be empty."));
          return;
        }
        // Accept "className"/"class"/"name" and "color"/"hex" as
        // reasonable header variants, rather than requiring an exact
        // match — analysts editing this file by hand shouldn't have
        // to remember precise column names.
        const classHeader = headers.find((h) =>
          /^(class ?name|class|name)$/i.test(h.trim()),
        );
        const colorHeader = headers.find((h) =>
          /^(color|colour|hex)$/i.test(h.trim()),
        );
        if (!classHeader || !colorHeader) {
          reject(
            new Error(
              'Color file needs a class-name column (e.g. "className") and a color column (e.g. "color").',
            ),
          );
          return;
        }
        const overrides: Record<string, string> = {};
        const skippedRows: number[] = [];
        rows.forEach((row, index) => {
          const className = row[classHeader]?.trim();
          const color = row[colorHeader]?.trim();
          if (!className || !color || !HEX_COLOR_PATTERN.test(color)) {
            skippedRows.push(index + 2);
            return;
          }
          overrides[className] = color;
        });
        if (Object.keys(overrides).length === 0) {
          reject(new Error("No valid class/color pairs found in the file."));
          return;
        }
        resolve({ overrides, skippedRows });
      },
      error: (error) => reject(error),
    });
  });
}
