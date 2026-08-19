import { describe, expect, it } from "vitest";
import { getClassColor } from "../classColors";

/**
 * classColors.test.ts
 *
 * Covers #64 Tier 1: getClassColor's three-tier precedence (override >
 * built-in > generated). BUILTIN_CLASS_COLORS, fnv1aHash, generatedColor,
 * and hslToHex are intentionally NOT exported (per the file's own
 * header comment, to prevent bypassing the precedence chain), so this
 * suite only ever calls the public getClassColor() API — exactly as
 * every real consumer is required to.
 *
 * generatedColor()'s exact hex outputs below were computed via an
 * independent Python re-implementation of the same fnv1a hash +
 * HSL-to-hex algorithm (not hand-derived, not copied from a live run
 * of the actual code) before being written into these assertions.
 */

describe("getClassColor - precedence", () => {
  it("returns the manual override when one exists, even for a built-in class name", () => {
    const overrides = { normal: "#123456" };
    expect(getClassColor("normal", overrides)).toBe("#123456");
  });

  it("returns the built-in color when no override exists", () => {
    expect(getClassColor("normal")).toBe("#dddddd");
    expect(getClassColor("nss")).toBe("#dd0000");
    expect(getClassColor("qc")).toBe("#00dd00");
    expect(getClassColor("zt")).toBe("#0000dd");
  });

  it("falls through to a generated color for a class name that is neither overridden nor built-in", () => {
    // Independently verified: fnv1a("unknown") % 360 = 121 ->
    // hslToHex(121, 70, 52) = #2fda32
    expect(getClassColor("unknown")).toBe("#2fda32");
  });

  it("an override for an UNKNOWN class name still takes precedence over generation", () => {
    const overrides = { malware: "#ff00ff" };
    expect(getClassColor("malware", overrides)).toBe("#ff00ff");
  });

  it("defaults to an empty overrides object when none is passed, falling through correctly", () => {
    // No second argument at all - Phase 1 call-site compatibility,
    // per the file's own migration-phase documentation.
    expect(getClassColor("normal")).toBe("#dddddd");
    expect(getClassColor("totally-unmapped-class")).toBe(
      getClassColor("totally-unmapped-class", {}),
    );
  });

  it("an override object that does not contain this class name does not interfere with built-in lookup", () => {
    const overrides = { someOtherClass: "#111111" };
    expect(getClassColor("normal", overrides)).toBe("#dddddd");
  });
});

describe("getClassColor - generated color determinism", () => {
  it("the same class name always produces the same color across repeated calls", () => {
    const first = getClassColor("repeat-me");
    const second = getClassColor("repeat-me");
    const third = getClassColor("repeat-me");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("is independent of any other classes being passed via overrides - only THIS class's override matters", () => {
    const a = getClassColor("myclass", { otherclass: "#aaaaaa" });
    const b = getClassColor("myclass", { anotherclass: "#bbbbbb" });
    expect(a).toBe(b);
  });

  it("different class names generally produce different colors (spot-check, not a collision guarantee)", () => {
    const a = getClassColor("alpha-class");
    const b = getClassColor("beta-class");
    expect(a).not.toBe(b);
  });

  it("handles an empty string class name without throwing, producing a deterministic color", () => {
    // Independently verified: fnv1a("") % 360 = 61 -> #d7da2f
    // (the loop in fnv1aHash simply never executes for an empty
    // string, leaving the FNV offset basis as the hash input to %360)
    expect(() => getClassColor("")).not.toThrow();
    expect(getClassColor("")).toBe("#d7da2f");
  });

  it("is case-sensitive - different-case class names produce different colors, no normalization", () => {
    // Independently verified: fnv1a("UPPERCASE") % 360 = 347 -> #da2f54
    // "UPPERCASE" is not a built-in name in any case, so this exercises
    // the generated path, confirming case is not folded before hashing.
    expect(getClassColor("UPPERCASE")).toBe("#da2f54");
    expect(getClassColor("uppercase")).not.toBe(getClassColor("UPPERCASE"));
  });

  it("handles class names with special characters without throwing", () => {
    // Independently verified: fnv1a("special-chars_123") % 360 = 31 ->
    // #da872f
    expect(() => getClassColor("special-chars_123")).not.toThrow();
    expect(getClassColor("special-chars_123")).toBe("#da872f");
  });
});

describe("getClassColor - return format", () => {
  it("always returns a lowercase 6-digit hex string, regardless of which tier resolved it", () => {
    const hexPattern = /^#[0-9a-f]{6}$/;
    expect(getClassColor("normal")).toMatch(hexPattern); // built-in
    expect(getClassColor("normal", { normal: "#ABCDEF" })).toMatch(
      /^#[0-9A-Fa-f]{6}$/,
    ); // override - format is caller-controlled, not normalized by getClassColor
    expect(getClassColor("generated-class-name")).toMatch(hexPattern); // generated
  });
});
