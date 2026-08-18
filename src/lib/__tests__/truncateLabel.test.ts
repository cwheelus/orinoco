import { describe, it, expect } from "vitest";
import { truncateLabel } from "../truncateLabel";

describe("truncateLabel", () => {
  it("returns short names unchanged", () => {
    expect(truncateLabel("x", 8)).toBe("x");
    expect(truncateLabel("sales", 8)).toBe("sales");
  });

  it("returns exact-length names unchanged", () => {
    expect(truncateLabel("exactly8", 8)).toBe("exactly8");
    expect(truncateLabel("_leading", 8)).toBe("_leading");
  });

  it("straight-truncates names with no separator", () => {
    expect(truncateLabel("throughput", 8)).toBe("throughp");
  });

  it("splits on first underscore per spec examples", () => {
    expect(truncateLabel("marketing_sales", 8)).toBe("mark_sale");
    expect(truncateLabel("marketing_income", 8)).toBe("mark_inco");
  });

  it("splits on first underscore even for longer names", () => {
    expect(truncateLabel("average_bytes_transferred", 8)).toBe("aver_byte");
  });

  it("splits on first hyphen the same way", () => {
    expect(truncateLabel("bytes-per-packet", 8)).toBe("byte-per-");
  });

  it("uses only the FIRST separator", () => {
    expect(truncateLabel("avg_bytes_per_session", 8)).toBe("avg_byte");
  });

  it("documents the odd/even asymmetry: rendered length is 2*floor(maxLength/2)+1, an 8-char CONTENT budget not a hard cap", () => {
    expect(truncateLabel("marketing_sales", 8)).toHaveLength(9);
    expect(truncateLabel("marketing_sales", 7)).toBe("mar_sal");
    expect(truncateLabel("marketing_sales", 7)).toHaveLength(7);
    expect(truncateLabel("marketing_sales", 9)).toBe("mark_sale");
  });

  it("handles separator near the end gracefully", () => {
    // "trailing_x" - 10 chars, sep at index 8, before="trailing", after="x"
    expect(truncateLabel("trailing_x", 8)).toBe("trai_x");
  });
});
