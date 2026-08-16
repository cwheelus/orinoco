import { describe, expect, it } from "vitest";
import { getUnmatchedColorOverrides } from "../colorValidation";

/**
 * colorValidation.test.ts
 *
 * Covers #59's colors.csv typo/mismatch fix. Manually verified in the
 * browser before this suite was written (see #59 PR notes):
 *   - colors.csv loaded before any dataset -> CLR-101 deferred, no
 *     false "unmatched" warning
 *   - colors.csv loaded after a dataset, with a genuine typo -> CLR-051,
 *     naming exactly the unmatched class(es)
 *   - a SECOND dataset where the previously-unmatched class is now
 *     legitimate -> no new warning (proves fresh re-validation, not a
 *     stale blacklist)
 *   - malformed rows AND an unmatched class together -> both CLR-050
 *     and CLR-051 fire independently, neither masking the other
 *
 * This file tests only the pure comparison logic (getUnmatchedColorOverrides).
 * The severity/wording/CLR-05x vs CLR-101 branching lives in App.tsx's
 * handleColorFileSelected/handleFileSelected, which aren't unit tested
 * here — see #59's testing notes on React-handler coverage.
 */
describe("getUnmatchedColorOverrides", () => {
  it("returns an empty array when every override matches a real class", () => {
    const overrides = { normal: "#dddddd", nss: "#dd0000" };
    const availableClasses = ["normal", "nss", "qc", "zt"];
    expect(getUnmatchedColorOverrides(overrides, availableClasses)).toEqual([]);
  });

  it("identifies a single typo'd class name", () => {
    const overrides = { nomal: "#dddddd", nss: "#dd0000" };
    const availableClasses = ["normal", "nss", "qc", "zt"];
    expect(getUnmatchedColorOverrides(overrides, availableClasses)).toEqual([
      "nomal",
    ]);
  });

  it("identifies multiple unmatched classes", () => {
    const overrides = {
      nomal: "#111111",
      nsss: "#222222",
      qc: "#333333",
    };
    const availableClasses = ["normal", "nss", "qc", "zt"];
    const result = getUnmatchedColorOverrides(overrides, availableClasses);
    expect(result.sort()).toEqual(["nomal", "nsss"]);
  });

  it("treats an empty availableClasses list as everything unmatched", () => {
    // This is the "colors loaded before any dataset" shape at the
    // pure-function level — App.tsx is responsible for NOT calling
    // this function in that case (deferring to CLR-101 instead), but
    // the function itself has no special-case awareness of "no
    // dataset yet" vs. "dataset with zero classes" - both look the
    // same to it. That distinction is the caller's job.
    const overrides = { normal: "#dddddd" };
    expect(getUnmatchedColorOverrides(overrides, [])).toEqual(["normal"]);
  });

  it("returns an empty array when there are no overrides at all", () => {
    expect(getUnmatchedColorOverrides({}, ["normal", "nss"])).toEqual([]);
  });

  it("is case-sensitive — 'NSS' does not match 'nss'", () => {
    // Confirmed in browser testing: availableClasses stores the raw
    // (lowercase) className values from the dataset, while the
    // legend/UI displays them uppercase via CSS only. A color file
    // override must match the underlying value exactly.
    const overrides = { NSS: "#dd0000" };
    const availableClasses = ["normal", "nss", "qc", "zt"];
    expect(getUnmatchedColorOverrides(overrides, availableClasses)).toEqual([
      "NSS",
    ]);
  });

  it("re-validates fresh against a DIFFERENT set of available classes — a class unmatched against one dataset can be matched against another", () => {
    // This is the exact scenario proven in browser testing: loading
    // dataset A (no "nomal" class) flags it unmatched; loading
    // dataset B (where "nomal" IS a real class) must NOT still flag
    // it. getUnmatchedColorOverrides has no memory between calls —
    // each call is independent, which is what makes this possible.
    const overrides = { nomal: "#dddddd", nss: "#dd0000" };

    const againstDatasetA = getUnmatchedColorOverrides(overrides, [
      "normal",
      "nss",
      "qc",
      "zt",
    ]);
    expect(againstDatasetA).toEqual(["nomal"]);

    const againstDatasetB = getUnmatchedColorOverrides(overrides, [
      "nomal",
      "nss",
    ]);
    expect(againstDatasetB).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const overrides = { nomal: "#dddddd" };
    const availableClasses = ["normal"];
    const overridesCopy = { ...overrides };
    const classesCopy = [...availableClasses];

    getUnmatchedColorOverrides(overrides, availableClasses);

    expect(overrides).toEqual(overridesCopy);
    expect(availableClasses).toEqual(classesCopy);
  });
});
