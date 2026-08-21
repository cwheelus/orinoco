import { describe, expect, it } from "vitest";
import { isVisible } from "../../components/PointCloud";
import type { DataPoint } from "../../types";
import type { NumericFilter, NumericFilters } from "../../store/useStore";
import type { OctantSign } from "../gridSpace";

/**
 * isVisible.test.ts
 *
 * Covers #64 Tier 1's "hiddenClasses filtering logic" item. isVisible()
 * is the rule PointCloud applies once per point to decide whether it is
 * drawn at all: class hidden? numeric filters satisfied? inside the
 * isolated octant? It was extracted from PointCloud's render loop for
 * exactly the reason passesNumeric was — the decision is pure logic and
 * shouldn't need a WebGL context to verify.
 *
 * passesNumeric's own operators are covered exhaustively in
 * passesNumeric.test.ts and are not re-tested here. What this suite
 * covers instead is the COMBINATION: that the three filters AND
 * together, so relaxing one never resurrects a point another one
 * excluded — the failure an analyst would read as "I un-hid that class
 * and its points still aren't showing".
 */

function point(className: string, x = 1, y = 1, z = 1): DataPoint {
  return { uid: `${className}-${x}-${y}-${z}`, x, y, z, className };
}

const OFF: NumericFilter = { op: "off", value: "", value2: "" };
const NO_FILTERS: NumericFilters = { x: OFF, y: OFF, z: OFF };

/** Numeric filters with one axis constrained, the rest off. */
function onAxis(axis: "x" | "y" | "z", f: NumericFilter): NumericFilters {
  return { ...NO_FILTERS, [axis]: f };
}

const NOTHING_HIDDEN: ReadonlySet<string> = new Set<string>();
const NO_OCTANT: OctantSign | null = null;

describe("isVisible - hidden classes", () => {
  it("shows a point when nothing is hidden", () => {
    expect(
      isVisible(point("normal"), NOTHING_HIDDEN, NO_FILTERS, NO_OCTANT),
    ).toBe(true);
  });

  it("hides a point whose class is in the hidden set", () => {
    expect(
      isVisible(point("scan"), new Set(["scan"]), NO_FILTERS, NO_OCTANT),
    ).toBe(false);
  });

  it("hides only the named class, leaving other classes visible", () => {
    const hidden = new Set(["scan"]);

    expect(isVisible(point("scan"), hidden, NO_FILTERS, NO_OCTANT)).toBe(false);
    expect(isVisible(point("normal"), hidden, NO_FILTERS, NO_OCTANT)).toBe(
      true,
    );
    expect(isVisible(point("dos"), hidden, NO_FILTERS, NO_OCTANT)).toBe(true);
  });

  it("hides every class when all of them are hidden", () => {
    const hidden = new Set(["scan", "normal"]);

    expect(isVisible(point("scan"), hidden, NO_FILTERS, NO_OCTANT)).toBe(false);
    expect(isVisible(point("normal"), hidden, NO_FILTERS, NO_OCTANT)).toBe(
      false,
    );
  });

  it("matches class names exactly — no case folding, no trimming", () => {
    // The hidden list is built from the dataset's own class strings
    // (useStore's uniqueClasses), so a near-miss here would mean the
    // Data page's toggle silently hid nothing.
    const hidden = new Set(["Scan"]);

    expect(isVisible(point("Scan"), hidden, NO_FILTERS, NO_OCTANT)).toBe(false);
    expect(isVisible(point("scan"), hidden, NO_FILTERS, NO_OCTANT)).toBe(true);
    expect(isVisible(point(" Scan"), hidden, NO_FILTERS, NO_OCTANT)).toBe(true);
  });

  it("handles a class name that is the empty string", () => {
    // parseCSV can produce an empty className from a blank class cell,
    // and the Data page lists it like any other class. Hiding it must
    // hide those points and nothing else.
    const hidden = new Set([""]);

    expect(isVisible(point(""), hidden, NO_FILTERS, NO_OCTANT)).toBe(false);
    expect(isVisible(point("normal"), hidden, NO_FILTERS, NO_OCTANT)).toBe(
      true,
    );
  });

  it("does not treat inherited Object properties as hidden class names", () => {
    // A Set is used precisely so class names can't collide with object
    // prototype keys the way a plain-object lookup would.
    expect(
      isVisible(point("toString"), NOTHING_HIDDEN, NO_FILTERS, NO_OCTANT),
    ).toBe(true);
    expect(
      isVisible(point("constructor"), NOTHING_HIDDEN, NO_FILTERS, NO_OCTANT),
    ).toBe(true);
  });
});

describe("isVisible - class hiding combined with numeric filters", () => {
  it("hides a point whose class is hidden even when it passes every filter", () => {
    const p = point("scan", 100, 100, 100);
    const filters = onAxis("x", { op: "gt", value: "10", value2: "" });

    expect(isVisible(p, NOTHING_HIDDEN, filters, NO_OCTANT)).toBe(true);
    expect(isVisible(p, new Set(["scan"]), filters, NO_OCTANT)).toBe(false);
  });

  it("keeps a point hidden by a numeric filter even when its class is visible", () => {
    const p = point("normal", 1, 1, 1);
    const filters = onAxis("x", { op: "gt", value: "10", value2: "" });

    expect(isVisible(p, NOTHING_HIDDEN, filters, NO_OCTANT)).toBe(false);
  });

  it("requires every axis filter to pass, not just one", () => {
    const p = point("normal", 50, 1, 50);
    const filters: NumericFilters = {
      x: { op: "gt", value: "10", value2: "" },
      y: { op: "gt", value: "10", value2: "" },
      z: OFF,
    };

    // X passes, Y doesn't — the point stays hidden.
    expect(isVisible(p, NOTHING_HIDDEN, filters, NO_OCTANT)).toBe(false);
  });

  it("filters on each axis independently", () => {
    const p = point("normal", 5, 5, 5);

    expect(
      isVisible(
        p,
        NOTHING_HIDDEN,
        onAxis("z", { op: "lt", value: "1", value2: "" }),
        NO_OCTANT,
      ),
    ).toBe(false);
    expect(
      isVisible(
        p,
        NOTHING_HIDDEN,
        onAxis("z", { op: "lt", value: "10", value2: "" }),
        NO_OCTANT,
      ),
    ).toBe(true);
  });

  it("shows the point again once both the class and the filter are cleared", () => {
    const p = point("scan", 1, 1, 1);
    const filters = onAxis("x", { op: "gt", value: "10", value2: "" });

    expect(isVisible(p, new Set(["scan"]), filters, NO_OCTANT)).toBe(false);
    // Un-hiding alone is not enough — the numeric filter still excludes it.
    expect(isVisible(p, NOTHING_HIDDEN, filters, NO_OCTANT)).toBe(false);
    expect(isVisible(p, NOTHING_HIDDEN, NO_FILTERS, NO_OCTANT)).toBe(true);
  });
});

describe("isVisible - class hiding combined with octant isolation", () => {
  const POSITIVE: OctantSign = [1, 1, 1];

  it("shows an in-octant point of a visible class", () => {
    expect(
      isVisible(point("normal", 1, 2, 3), NOTHING_HIDDEN, NO_FILTERS, POSITIVE),
    ).toBe(true);
  });

  it("hides an out-of-octant point even though its class is visible", () => {
    expect(
      isVisible(
        point("normal", -1, 2, 3),
        NOTHING_HIDDEN,
        NO_FILTERS,
        POSITIVE,
      ),
    ).toBe(false);
  });

  it("hides a point that is both out of octant and in a hidden class", () => {
    expect(
      isVisible(point("scan", -1, -2, -3), new Set(["scan"]), NO_FILTERS, [
        1, 1, 1,
      ]),
    ).toBe(false);
  });

  it("hides an in-octant point whose class is hidden", () => {
    expect(
      isVisible(point("scan", 1, 2, 3), new Set(["scan"]), NO_FILTERS, POSITIVE),
    ).toBe(false);
  });

  it("ignores octant membership when no octant is isolated", () => {
    expect(
      isVisible(
        point("normal", -1, -2, -3),
        NOTHING_HIDDEN,
        NO_FILTERS,
        NO_OCTANT,
      ),
    ).toBe(true);
  });
});

describe("isVisible - all three filters together", () => {
  it("shows a point only when class, filters, and octant all allow it", () => {
    const p = point("normal", 5, 5, 5);
    const filters = onAxis("x", { op: "gte", value: "5", value2: "" });
    const octant: OctantSign = [1, 1, 1];

    expect(isVisible(p, NOTHING_HIDDEN, filters, octant)).toBe(true);

    // Each rule, on its own, is enough to hide it.
    expect(isVisible(p, new Set(["normal"]), filters, octant)).toBe(false);
    expect(
      isVisible(
        p,
        NOTHING_HIDDEN,
        onAxis("x", { op: "gt", value: "5", value2: "" }),
        octant,
      ),
    ).toBe(false);
    expect(isVisible(p, NOTHING_HIDDEN, filters, [-1, 1, 1])).toBe(false);
  });
});
