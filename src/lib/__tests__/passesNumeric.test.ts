import { describe, it, expect } from "vitest";
import { passesNumeric } from "../../components/PointCloud";
import type { NumericFilter } from "../../store/useStore";

/**
 * passesNumeric.test.ts
 *
 * Covers #59's "Filters — check for any existing bugs" item. This is
 * the actual filter-evaluation logic behind the Data page's per-axis
 * numeric filters (Toolbar.tsx) and PointCloud's visible-point
 * computation.
 */

function filter(
  op: NumericFilter["op"],
  value = "",
  value2 = "",
): NumericFilter {
  return { op, value, value2 };
}

describe("passesNumeric", () => {
  it("passes everything when the filter is off", () => {
    expect(passesNumeric(100, filter("off"))).toBe(true);
    expect(passesNumeric(-999, filter("off"))).toBe(true);
  });

  describe("single-operand comparisons", () => {
    it("gt (strictly greater than)", () => {
      const f = filter("gt", "10");
      expect(passesNumeric(11, f)).toBe(true);
      expect(passesNumeric(10, f)).toBe(false);
      expect(passesNumeric(9, f)).toBe(false);
    });

    it("gte (greater than or equal)", () => {
      const f = filter("gte", "10");
      expect(passesNumeric(10, f)).toBe(true);
      expect(passesNumeric(9, f)).toBe(false);
    });

    it("lt (strictly less than)", () => {
      const f = filter("lt", "10");
      expect(passesNumeric(9, f)).toBe(true);
      expect(passesNumeric(10, f)).toBe(false);
    });

    it("lte (less than or equal)", () => {
      const f = filter("lte", "10");
      expect(passesNumeric(10, f)).toBe(true);
      expect(passesNumeric(11, f)).toBe(false);
    });

    it("eq (exact equality)", () => {
      const f = filter("eq", "10");
      expect(passesNumeric(10, f)).toBe(true);
      expect(passesNumeric(10.0001, f)).toBe(false);
    });
  });

  describe("between (inclusive range)", () => {
    it("passes values inside the range, rejects values outside", () => {
      const f = filter("between", "10", "20");
      expect(passesNumeric(10, f)).toBe(true); // inclusive lower bound
      expect(passesNumeric(20, f)).toBe(true); // inclusive upper bound
      expect(passesNumeric(15, f)).toBe(true);
      expect(passesNumeric(9, f)).toBe(false);
      expect(passesNumeric(21, f)).toBe(false);
    });

    it("acts as a single-sided >= bound when only the min box is filled", () => {
      const f = filter("between", "10", "");
      expect(passesNumeric(10, f)).toBe(true);
      expect(passesNumeric(1000, f)).toBe(true);
      expect(passesNumeric(9, f)).toBe(false);
    });

    it("acts as a single-sided <= bound when only the max box is filled", () => {
      const f = filter("between", "", "20");
      expect(passesNumeric(20, f)).toBe(true);
      expect(passesNumeric(-1000, f)).toBe(true);
      expect(passesNumeric(21, f)).toBe(false);
    });

    it("passes everything when BOTH boxes are empty", () => {
      const f = filter("between", "", "");
      expect(passesNumeric(0, f)).toBe(true);
      expect(passesNumeric(-999999, f)).toBe(true);
      expect(passesNumeric(999999, f)).toBe(true);
    });

    it("treats a non-numeric min box as blank (single-sided max only)", () => {
      const f = filter("between", "abc", "20");
      expect(passesNumeric(20, f)).toBe(true);
      expect(passesNumeric(-1000, f)).toBe(true); // min ignored, no lower bound
      expect(passesNumeric(21, f)).toBe(false);
    });

    it("FIXED (#59): an inverted range (min > max) is auto-corrected by swapping the bounds, rather than silently excluding every point", () => {
      // Originally: an analyst typing min=20, max=10 got a filter that
      // silently matched nothing, with no error or indication why.
      // Fixed by treating the bounds as a range regardless of which
      // was typed into which box.
      const f = filter("between", "20", "10");
      expect(passesNumeric(15, f)).toBe(true); // inside [10, 20]
      expect(passesNumeric(10, f)).toBe(true); // inclusive lower
      expect(passesNumeric(20, f)).toBe(true); // inclusive upper
      expect(passesNumeric(9, f)).toBe(false);
      expect(passesNumeric(21, f)).toBe(false);
    });
  });

  describe("blank or invalid single-operand values", () => {
    it("treats an empty value box as 'no filter' (passes everything)", () => {
      const f = filter("gt", "");
      expect(passesNumeric(0, f)).toBe(true);
      expect(passesNumeric(-999, f)).toBe(true);
    });

    it("treats a non-numeric value box the same way (mid-typing, e.g. a lone '-')", () => {
      const f = filter("gt", "-");
      expect(passesNumeric(0, f)).toBe(true);
    });
  });

  describe("edge values", () => {
    it("handles negative thresholds correctly", () => {
      const f = filter("gt", "-50");
      expect(passesNumeric(-49, f)).toBe(true);
      expect(passesNumeric(-50, f)).toBe(false);
      expect(passesNumeric(-51, f)).toBe(false);
    });

    it("handles zero as a threshold correctly (not confused with 'blank')", () => {
      const f = filter("gte", "0");
      expect(passesNumeric(0, f)).toBe(true);
      expect(passesNumeric(-1, f)).toBe(false);
    });
  });
});
