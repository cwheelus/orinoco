import { describe, expect, it } from "vitest";
import { parseCSV, buildPoints } from "../parseCSV";
import { CODES } from "../errorCodes";

function csvFile(csv: string): File {
  return new File([csv], "test.csv", { type: "text/csv" });
}

async function expectParseError(csv: string) {
  try {
    await parseCSV(csvFile(csv));
    throw new Error("Expected parseCSV to reject");
  } catch (error) {
    return error as {
      appCode?: { code?: string };
      message?: string;
      detail?: string[];
    };
  }
}

describe("parseCSV", () => {
  it("parses a normal 3D dataset", async () => {
    const result = await parseCSV(
      csvFile(
        ["uid,class,x,y,z", "u1,A,1,2,3", "u2,B,4,5,6", "u3,A,7,8,9"].join(
          "\n",
        ),
      ),
    );

    expect(result.schema.dimension).toBe(3);
    expect(result.schema.numericColumns).toEqual(["x", "y", "z"]);
    expect(result.mapping.x).toBe("x");
    expect(result.mapping.y).toBe("y");
    expect(result.mapping.z).toBe("z");
    expect(result.points).toHaveLength(3);
  });

  it("treats exactly two numeric columns as a 2D dataset", async () => {
    const result = await parseCSV(
      csvFile(["uid,class,x,y", "u1,A,1,2", "u2,B,3,4", "u3,A,5,6"].join("\n")),
    );

    expect(result.schema.dimension).toBe(2);
    expect(result.schema.numericColumns).toEqual(["x", "y"]);
    expect(result.mapping.x).toBe("x");
    expect(result.mapping.y).toBe("y");
    expect(result.mapping.z).toBeUndefined();

    expect(result.points).toEqual([
      { uid: "u1", className: "A", x: 1, y: 2, z: 0 },
      { uid: "u2", className: "B", x: 3, y: 4, z: 0 },
      { uid: "u3", className: "A", x: 5, y: 6, z: 0 },
    ]);
  });

  it("classifies 45/50 numeric sampled values as numeric at the 90% threshold", async () => {
    const rows = Array.from(
      { length: 50 },
      (_, i) => `u${i},A,${i},${i + 1},${i + 2}`,
    );

    for (const index of [0, 1, 2, 3, 4]) {
      rows[index] = `u${index},A,bad,${index + 1},${index + 2}`;
    }

    const result = await parseCSV(
      csvFile(["uid,class,x,y,z", ...rows].join("\n")),
    );

    expect(result.schema.numericColumns).toContain("x");
  });

  it("classifies 44/50 numeric sampled values as text below the 90% threshold", async () => {
    const rows = Array.from(
      { length: 50 },
      (_, i) => `u${i},A,${i},${i + 1},${i + 2}`,
    );

    for (const index of [0, 1, 2, 3, 4, 5]) {
      rows[index] = `u${index},A,bad,${index + 1},${index + 2}`;
    }

    const result = await parseCSV(
      csvFile(["uid,class,x,y,z", ...rows].join("\n")),
    );

    expect(result.schema.numericColumns).not.toContain("x");
    expect(result.schema.textColumns).toContain("x");
  });

  it("skips malformed numeric rows while preserving valid rows", async () => {
    // 10 rows, 1 bad x value: 9/10 = 90%, right at the threshold
    // boundary, so x stays classified NUMERIC and the bad row is
    // caught at row-validation. A 3-row fixture with 1 bad value would
    // put x at 2/3 = 66.7%, which falls BELOW threshold and
    // reclassifies the whole column as text — so the bad value would
    // never actually be mapped to an axis, and no row would fail.
    const csv = [
      "uid,class,x,y,z",
      "u1,A,1,2,3",
      "u2,B,not-a-number,5,6",
      "u3,A,7,8,9",
      "u4,B,10,11,12",
      "u5,A,13,14,15",
      "u6,B,16,17,18",
      "u7,A,19,20,21",
      "u8,B,22,23,24",
      "u9,A,25,26,27",
      "u10,B,28,29,30",
    ].join("\n");

    const result = await parseCSV(csvFile(csv));

    expect(result.schema.numericColumns).toEqual(["x", "y", "z"]);
    expect(result.points).toHaveLength(9);
    expect(result.points.map((p) => p.uid)).not.toContain("u2");

    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0]).toEqual({
      row: 3,
      reason: 'x is not a number ("not-a-number")',
    });
  });

  it("reports the offending column and value for malformed rows", async () => {
    // 10 rows, one bad value each in y and z on different rows: each
    // column stays at 9/10 = 90%, so both remain numeric and get
    // caught individually at row-validation.
    const csv = [
      "uid,class,x,y,z",
      "u1,A,1,2,3",
      "u2,B,4,invalid-y,6",
      "u3,A,7,8,invalid-z",
      "u4,B,10,11,12",
      "u5,A,13,14,15",
      "u6,B,16,17,18",
      "u7,A,19,20,21",
      "u8,B,22,23,24",
      "u9,A,25,26,27",
      "u10,B,28,29,30",
    ].join("\n");

    const result = await parseCSV(csvFile(csv));

    expect(result.schema.numericColumns).toEqual(["x", "y", "z"]);
    expect(result.skippedRows).toEqual([
      { row: 3, reason: 'y is not a number ("invalid-y")' },
      { row: 4, reason: 'z is not a number ("invalid-z")' },
    ]);
  });

  it("skips rows with empty UID or class values", async () => {
    const result = await parseCSV(
      csvFile(
        ["uid,class,x,y,z", "u1,A,1,2,3", ",B,4,5,6", "u3,,7,8,9"].join("\n"),
      ),
    );

    expect(result.points).toHaveLength(1);

    expect(result.skippedRows).toEqual([
      { row: 3, reason: "uid is empty" },
      { row: 4, reason: "class is empty" },
    ]);
  });

  it("rejects when there are fewer than two numeric columns", async () => {
    const error = await expectParseError(
      ["uid,class,x,label", "u1,A,1,hello", "u2,B,2,world"].join("\n"),
    );

    expect(error.appCode?.code).toBe(CODES.CSV_TOO_FEW_NUMERIC.code);
  });

  it("rejects when there are no text columns", async () => {
    const error = await expectParseError(
      ["x,y,z", "1,2,3", "4,5,6"].join("\n"),
    );

    expect(error.appCode?.code).toBe(CODES.CSV_NO_TEXT_COLUMNS.code);
  });

  it("rejects when the CSV has no data rows", async () => {
    const error = await expectParseError("uid,class,x,y,z");

    expect(error.appCode?.code).toBe(CODES.CSV_EMPTY.code);
  });

  it("rejects when every row is invalid", async () => {
    // x/y stay 100% numeric (structural requirement genuinely met),
    // but uid is empty on every row, so every row fails at ROW
    // validation and zero points survive — the real CSV-004 case. A
    // fixture that makes x/y only partially numeric instead would
    // reclassify them as TEXT, dropping the numeric-column count and
    // triggering CSV-002 before row validation ever ran.
    const rows = Array.from(
      { length: 10 },
      (_, i) => `,A,${i + 1},${i + 2}`, // uid always empty
    );

    const error = await expectParseError(["uid,class,x,y", ...rows].join("\n"));

    expect(error.appCode?.code).toBe(CODES.CSV_NO_VALID_ROWS.code);
  });

  it("preserves metadata columns beyond UID and class", async () => {
    const result = await parseCSV(
      csvFile(
        [
          "uid,class,x,y,z,department,description",
          "u1,A,1,2,3,sales,First point",
          "u2,B,4,5,6,engineering,Second point",
        ].join("\n"),
      ),
    );

    expect(result.schema.metadataColumns).toEqual([
      "department",
      "description",
    ]);

    expect(result.metadata.u1).toEqual({
      department: "sales",
      description: "First point",
    });

    expect(result.metadata.u2).toEqual({
      department: "engineering",
      description: "Second point",
    });
  });

  it("preserves UID values as the row identifiers", async () => {
    const result = await parseCSV(
      csvFile(
        ["uid,class,x,y,z", "row-001,A,1,2,3", "row-002,B,4,5,6"].join("\n"),
      ),
    );

    expect(result.points.map((point) => point.uid)).toEqual([
      "row-001",
      "row-002",
    ]);
  });

  it("allows the same numeric column to be mapped to multiple axes", async () => {
    const result = await parseCSV(
      csvFile(
        ["uid,class,x,y,z", "u1,A,1,2,3", "u2,B,4,5,6", "u3,A,7,8,9"].join(
          "\n",
        ),
      ),
    );

    const remapped = {
      ...result.mapping,
      x: "x",
      y: "x",
      z: "z",
    };

    const rebuilt = buildPoints(result.rows, result.schema, remapped);

    expect(rebuilt.points).toEqual([
      { uid: "u1", className: "A", x: 1, y: 1, z: 3 },
      { uid: "u2", className: "B", x: 4, y: 4, z: 6 },
      { uid: "u3", className: "A", x: 7, y: 7, z: 9 },
    ]);
  });

  it("allows a different numeric column to be selected for an axis", async () => {
    const result = await parseCSV(
      csvFile(
        ["uid,class,x,y,z,extra", "u1,A,1,2,3,100", "u2,B,4,5,6,200"].join(
          "\n",
        ),
      ),
    );

    const remapped = buildPoints(result.rows, result.schema, {
      ...result.mapping,
      x: "extra",
    });

    expect(remapped.points).toEqual([
      { uid: "u1", className: "A", x: 100, y: 2, z: 3 },
      { uid: "u2", className: "B", x: 200, y: 5, z: 6 },
    ]);
  });

  it("keeps long column and class names intact at the parser layer", async () => {
    const longClass = "marketing_sales_transaction_volume";
    const longColumn = "customer_transaction_amount";

    const result = await parseCSV(
      csvFile(
        [
          `uid,${longClass},${longColumn},y`,
          `u1,${longClass},100,1`,
          `u2,${longClass},200,2`,
        ].join("\n"),
      ),
    );

    expect(result.schema.headers).toContain(longClass);
    expect(result.schema.headers).toContain(longColumn);
    expect(result.points[0].className).toBe(longClass);
  });

  it("trims whitespace from UID and class values", async () => {
    const result = await parseCSV(
      csvFile(
        ["uid,class,x,y,z", " u1 , A ,1,2,3", " u2 , B ,4,5,6"].join("\n"),
      ),
    );

    expect(result.points.map((point) => point.uid)).toEqual(["u1", "u2"]);
    expect(result.points.map((point) => point.className)).toEqual(["A", "B"]);
  });
});

describe("ParseResult.interpretation", () => {
  it("clean 3D: all axes numeric, columns is just uid/class", async () => {
    const csv = [
      "uid,class,x,y,z",
      "u1,A,1,2,3",
      "u2,B,4,5,6",
      "u3,A,7,8,9",
    ].join("\n");

    const result = await parseCSV(csvFile(csv));

    expect(result.interpretation.numericColumns).toEqual(["x", "y", "z"]);
    expect(result.interpretation.dimension).toBe(3);
    expect(result.interpretation.columns.map((c) => c.column)).toEqual([
      "uid",
      "class",
    ]);
  });

  it("10-row isolation: y stays numeric at 90%, absent from columns entirely", async () => {
    const rows = Array.from(
      { length: 10 },
      (_, i) => `u${i + 1},A,${i + 1},${i + 2},${i + 3}`,
    );
    rows[2] = "u3,A,4,invalid-y,6";

    const result = await parseCSV(
      csvFile(["uid,class,x,y,z", ...rows].join("\n")),
    );

    expect(result.interpretation.numericColumns).toEqual(["x", "y", "z"]);
    expect(result.interpretation.dimension).toBe(3);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.interpretation.columns.map((c) => c.column)).toEqual([
      "uid",
      "class",
    ]);
  });

  it("small-file partial failure: y (67%) present in columns with its ratio and bad value", async () => {
    const csv = [
      "uid,class,x,y,z",
      "u1,A,1,2,3",
      "u2,B,4,invalid-y,6",
      "u3,A,7,8,9",
    ].join("\n");

    const result = await parseCSV(csvFile(csv));

    expect(result.interpretation.numericColumns).toEqual(["x", "z"]);
    expect(result.interpretation.dimension).toBe(2);
    expect(result.interpretation.columns.map((c) => c.column)).toEqual([
      "uid",
      "class",
      "y",
    ]);

    const yInterp = result.interpretation.columns.find((c) => c.column === "y");
    expect(yInterp).toMatchObject({
      numericCount: 2,
      sampledCount: 3,
      sampleBadValues: ["invalid-y"],
    });
  });

  it("small-file total failure: y (0%) present in columns, and now actively surfaced by the consumer (App.tsx no longer requires numericCount > 0 to report a column — see #59 resolution)", async () => {
    const csv = [
      "uid,class,x,y,z",
      "u1,A,1,bad,3",
      "u2,B,4,bad,6",
      "u3,A,7,bad,9",
    ].join("\n");

    const result = await parseCSV(csvFile(csv));

    expect(result.interpretation.dimension).toBe(2);
    expect(
      result.interpretation.columns.find((c) => c.column === "y"),
    ).toMatchObject({
      numericCount: 0,
      sampledCount: 3,
    });
  });

  it("genuine metadata: department/description present in columns at 0%, same shape as any other text column", async () => {
    const csv = [
      "uid,class,x,y,z,department,description",
      "u1,A,1,2,3,sales,First point",
      "u2,B,4,5,6,engineering,Second point",
    ].join("\n");

    const result = await parseCSV(csvFile(csv));

    expect(result.interpretation.numericColumns).toEqual(["x", "y", "z"]);
    expect(result.interpretation.columns.map((c) => c.column)).toEqual([
      "uid",
      "class",
      "department",
      "description",
    ]);

    const dept = result.interpretation.columns.find(
      (c) => c.column === "department",
    );
    expect(dept).toMatchObject({ numericCount: 0 });
  });
});
