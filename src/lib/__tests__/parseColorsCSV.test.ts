import { describe, expect, it } from "vitest";
import { parseColorsCSV } from "../parseColorsCSV";
import { CODES } from "../errorCodes";

function csvFile(csv: string): File {
  return new File([csv], "colors.csv", { type: "text/csv" });
}

async function expectParseError(csv: string) {
  try {
    await parseColorsCSV(csvFile(csv));
    throw new Error("Expected parseColorsCSV to reject");
  } catch (error) {
    return error as {
      appCode?: { code?: string };
      message?: string;
      detail?: string[];
    };
  }
}

describe("parseColorsCSV", () => {
  describe("the #59 typo question", () => {
    it("does not error on a misspelled class name - it becomes an override for a class that doesn't exist", async () => {
      const csv = ["className,color", "nomal,#dddddd", "nss,#dd0000"].join(
        "\n",
      );

      const result = await parseColorsCSV(csvFile(csv));

      expect(result.overrides).toEqual({
        nomal: "#dddddd",
        nss: "#dd0000",
      });
      expect(result.overrides.normal).toBeUndefined();
      expect(result.skippedRows).toHaveLength(0);
    });
  });

  describe("header matching", () => {
    it("accepts the canonical className/color headers", async () => {
      const csv = ["className,color", "normal,#dddddd"].join("\n");
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ normal: "#dddddd" });
    });

    it("accepts flexible header spellings (case/space/underscore/hyphen insensitive)", async () => {
      const csv = ["Class Name,Colour", "normal,#dddddd"].join("\n");
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ normal: "#dddddd" });
    });

    it("ignores extra columns beyond className/color", async () => {
      const csv = [
        "className,color,notes",
        "normal,#dddddd,some note here",
      ].join("\n");
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ normal: "#dddddd" });
    });

    it("rejects a file missing both required headers", async () => {
      const csv = ["category,shade", "normal,#ff0000"].join("\n");
      const error = await expectParseError(csv);
      expect(error.appCode?.code).toBe(CODES.CLR_MISSING_HEADERS.code);
    });

    it("rejects a file missing just the color header", async () => {
      const csv = ["className,shade", "normal,#ff0000"].join("\n");
      const error = await expectParseError(csv);
      expect(error.appCode?.code).toBe(CODES.CLR_MISSING_HEADERS.code);
    });
  });

  describe("malformed rows", () => {
    it("skips a row with an invalid (non-hex) color, keeps valid rows", async () => {
      const csv = ["className,color", "normal,red", "nss,#dd0000"].join("\n");

      const result = await parseColorsCSV(csvFile(csv));

      expect(result.overrides).toEqual({ nss: "#dd0000" });
      expect(result.skippedRows).toEqual([
        { row: 2, reason: expect.stringContaining("red") },
      ]);
    });

    it("skips a row with an empty class name", async () => {
      const csv = ["className,color", ",#123456", "normal,#dddddd"].join("\n");
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ normal: "#dddddd" });
      expect(result.skippedRows).toHaveLength(1);
      expect(result.skippedRows[0].reason).toContain("empty");
    });

    it("skips a row with an empty color value", async () => {
      const csv = ["className,color", "normal,", "nss,#dd0000"].join("\n");
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ nss: "#dd0000" });
      expect(result.skippedRows[0].reason).toContain("empty");
    });

    it("skips multiple rows for different reasons, each with its own explanation", async () => {
      const csv = [
        "className,color",
        "normal,red",
        ",#dddddd",
        "nss,#dd0000",
        "qc,",
      ].join("\n");

      const result = await parseColorsCSV(csvFile(csv));

      expect(result.overrides).toEqual({ nss: "#dd0000" });
      expect(result.skippedRows).toHaveLength(3);
    });

    it("rejects a file where every row is invalid", async () => {
      const csv = ["className,color", "normal,red", "nss,not-a-color"].join(
        "\n",
      );
      const error = await expectParseError(csv);
      expect(error.appCode?.code).toBe(CODES.CLR_NO_VALID_PAIRS.code);
    });

    it("rejects an empty file", async () => {
      const error = await expectParseError("");
      expect(error.appCode?.code).toBe(CODES.CLR_EMPTY.code);
    });

    it("rejects a file with headers but no data rows", async () => {
      const error = await expectParseError("className,color");
      expect(error.appCode?.code).toBe(CODES.CLR_EMPTY.code);
    });
  });

  describe("trimming and whitespace", () => {
    it("trims whitespace from class names and color values", async () => {
      const csv = ["className,color", " normal , #dddddd "].join("\n");
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ normal: "#dddddd" });
    });
  });

  describe("duplicate class names", () => {
    it("keeps the LAST override when the same class name appears twice", async () => {
      const csv = ["className,color", "normal,#111111", "normal,#222222"].join(
        "\n",
      );
      const result = await parseColorsCSV(csvFile(csv));
      expect(result.overrides).toEqual({ normal: "#222222" });
    });
  });
});
