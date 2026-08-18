import { describe, it, expect } from "vitest";
import { appError, isAppError, describeError, CODES } from "../errorCodes";

describe("isAppError", () => {
  it("accepts an error built by appError()", () => {
    const err = appError(CODES.CSV_EMPTY, "empty", ["line one"]);
    expect(isAppError(err)).toBe(true);
  });

  it("rejects a plain Error", () => {
    expect(isAppError(new Error("boom"))).toBe(false);
  });

  it("rejects non-Error values", () => {
    expect(isAppError("boom")).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ appCode: CODES.CSV_EMPTY })).toBe(false);
  });

  // The old `"appCode" in err` guard passed these through, and the
  // console then rendered a row with an undefined code/severity/title.
  it("rejects an Error carrying a malformed appCode", () => {
    const halfBuilt = Object.assign(new Error("half"), {
      name: "AppError",
      appCode: { code: "CSV-001" },
    });
    expect(isAppError(halfBuilt)).toBe(false);

    const badSeverity = Object.assign(new Error("bad"), {
      name: "AppError",
      appCode: { code: "CSV-001", severity: "critical", title: "Nope" },
    });
    expect(isAppError(badSeverity)).toBe(false);

    const foreign = Object.assign(new Error("foreign"), {
      appCode: "CSV-001",
    });
    expect(isAppError(foreign)).toBe(false);
  });

  it("accepts a cross-realm-like Error with the correct shape", () => {
    // Simulates an Error from another realm (iframe/worker) where
    // `instanceof Error` would be false but the shape is valid.
    const crossRealm = {
      name: "AppError",
      message: "cross-realm",
      appCode: CODES.CSV_EMPTY,
    };
    expect(crossRealm instanceof Error).toBe(false);
    expect(isAppError(crossRealm)).toBe(true);
  });
});

describe("describeError", () => {
  it("passes a coded error through unchanged", () => {
    const err = appError(CODES.CLR_EMPTY, "no rows", ["detail"]);
    expect(describeError(err, "fallback")).toEqual({
      appCode: CODES.CLR_EMPTY,
      message: "no rows",
      detail: ["detail"],
    });
  });

  it("falls back to APP_UNEXPECTED for anything else, keeping the message", () => {
    expect(describeError(new Error("boom"), "fallback")).toEqual({
      appCode: CODES.APP_UNEXPECTED,
      message: "boom",
    });
    expect(describeError("a bare string", "fallback")).toEqual({
      appCode: CODES.APP_UNEXPECTED,
      message: "fallback",
    });
  });
});
