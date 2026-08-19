import { describe, expect, it } from "vitest";
import {
  computeGridSpace,
  inOctant,
  GRID_MIN,
  GRID_MAX,
  type ScalingConfig,
  type OctantSign,
} from "../gridSpace";
import type { DataPoint } from "../../types";

/**
 * gridSpace.test.ts
 *
 * Covers #64 Tier 1: computeGridSpace, all three scaling modes, octant
 * isolation, and inOctant's boundary assignment. Built directly against
 * the confirmed real implementation of gridSpace.ts — every expected
 * value below is derived from that source, not assumed.
 */

function point(x: number, y: number, z: number, uid = "u"): DataPoint {
  return { uid, className: "A", x, y, z };
}

const normalizedConfig: ScalingConfig = {
  mode: "normalized",
  custom: { x: NaN, y: NaN, z: NaN },
};

describe("computeGridSpace - normalized (auto) scaling mode", () => {
  it("matches the documented worked example: 3676.470588 * 1.1 rounds outward to 4045", () => {
    const points = [point(0, 3676.470588, 0)];
    const space = computeGridSpace(points, normalizedConfig, null);
    expect(space.DISPLAY_RANGE.y.max).toBe(4045);
    expect(space.DISPLAY_RANGE.y.min).toBe(-4045);
  });

  it("computes each axis independently from its own farthest value", () => {
    const points = [point(10, 1000, 1)];
    const space = computeGridSpace(points, normalizedConfig, null);
    expect(space.DISPLAY_RANGE.x.max).toBe(11);
    expect(space.DISPLAY_RANGE.y.max).toBe(1100);
    expect(space.DISPLAY_RANGE.z.max).toBe(2);
  });

  it("uses the farthest-from-zero magnitude regardless of sign", () => {
    const points = [point(-500, 0, 0), point(100, 0, 0)];
    const space = computeGridSpace(points, normalizedConfig, null);
    expect(space.DISPLAY_RANGE.x.max).toBe(550);
    expect(space.DISPLAY_RANGE.x.min).toBe(-550);
  });

  it("floors the half-extent at 1 for an all-zero axis (degenerate case)", () => {
    const points = [point(0, 0, 0)];
    const space = computeGridSpace(points, normalizedConfig, null);
    expect(space.DISPLAY_RANGE.x.max).toBe(1);
    expect(space.DISPLAY_RANGE.y.max).toBe(1);
    expect(space.DISPLAY_RANGE.z.max).toBe(1);
  });

  it("falls back to the degenerate [-1, 1] default for an empty dataset", () => {
    const space = computeGridSpace([], normalizedConfig, null);
    expect(space.DISPLAY_RANGE.x).toEqual({ min: -1, max: 1 });
    expect(space.DISPLAY_RANGE.y).toEqual({ min: -1, max: 1 });
    expect(space.DISPLAY_RANGE.z).toEqual({ min: -1, max: 1 });
  });
});

describe("computeGridSpace - real (shared) scaling mode", () => {
  it("uses ONE shared half-extent, derived from the single farthest value across all axes", () => {
    const realConfig: ScalingConfig = {
      mode: "real",
      custom: { x: NaN, y: NaN, z: NaN },
    };
    const points = [point(10, 1000, 1)];
    const space = computeGridSpace(points, realConfig, null);
    expect(space.DISPLAY_RANGE.x.max).toBe(1100);
    expect(space.DISPLAY_RANGE.y.max).toBe(1100);
    expect(space.DISPLAY_RANGE.z.max).toBe(1100);
  });

  it("gives every axis the same SCALE, since the render box (GRID_MIN..GRID_MAX) is fixed and the ranges are now identical", () => {
    const realConfig: ScalingConfig = {
      mode: "real",
      custom: { x: NaN, y: NaN, z: NaN },
    };
    const points = [point(50, 5, 500)];
    const space = computeGridSpace(points, realConfig, null);
    expect(space.SCALE.x).toBeCloseTo(space.SCALE.y, 10);
    expect(space.SCALE.y).toBeCloseTo(space.SCALE.z, 10);
  });
});

describe("computeGridSpace - custom scaling mode", () => {
  it("uses the typed bound when valid (> 0)", () => {
    const customConfig: ScalingConfig = {
      mode: "custom",
      custom: { x: 500, y: NaN, z: NaN },
    };
    const points = [point(100, 100, 100)];
    const space = computeGridSpace(points, customConfig, null);
    expect(space.DISPLAY_RANGE.x.max).toBe(500);
  });

  it("falls back to the auto-normalized value for an axis left blank (NaN)", () => {
    const customConfig: ScalingConfig = {
      mode: "custom",
      custom: { x: 500, y: NaN, z: NaN },
    };
    const points = [point(100, 100, 100)];
    const space = computeGridSpace(points, customConfig, null);
    // 100 * 1.1 = 110.00000000000001 in IEEE 754 double precision,
    // so ceil produces 111, not 110.
    expect(space.DISPLAY_RANGE.y.max).toBe(111);
  });

  it("falls back to auto for a custom bound of exactly 0 or negative (not just NaN)", () => {
    const customConfig: ScalingConfig = {
      mode: "custom",
      custom: { x: 0, y: -50, z: NaN },
    };
    const points = [point(100, 100, 100)];
    const space = computeGridSpace(points, customConfig, null);
    expect(space.DISPLAY_RANGE.x.max).toBe(111);
    expect(space.DISPLAY_RANGE.y.max).toBe(111);
  });
});

describe("computeGridSpace - octant isolation", () => {
  it("makes the isolated axis one-sided [0, M] for a positive sign", () => {
    const points = [point(100, 100, 100)];
    const isolated: OctantSign = [1, 1, 1];
    const space = computeGridSpace(points, normalizedConfig, isolated);
    expect(space.DISPLAY_RANGE.x).toEqual({ min: 0, max: 111 });
  });

  it("makes the isolated axis one-sided [-M, 0] for a negative sign", () => {
    const points = [point(100, 100, 100)];
    const isolated: OctantSign = [-1, 1, 1];
    const space = computeGridSpace(points, normalizedConfig, isolated);
    expect(space.DISPLAY_RANGE.x).toEqual({ min: -111, max: 0 });
  });

  it("mixes signs per axis independently", () => {
    const points = [point(100, 100, 100)];
    const isolated: OctantSign = [1, -1, 1];
    const space = computeGridSpace(points, normalizedConfig, isolated);
    expect(space.DISPLAY_RANGE.x).toEqual({ min: 0, max: 111 });
    expect(space.DISPLAY_RANGE.y).toEqual({ min: -111, max: 0 });
    expect(space.DISPLAY_RANGE.z).toEqual({ min: 0, max: 111 });
  });

  it("CENTER shifts to ±M/2 when isolated, vs. 0 for the full grid", () => {
    const points = [point(100, 100, 100)];
    const full = computeGridSpace(points, normalizedConfig, null);
    expect(full.CENTER.x).toBe(0);

    const isolated: OctantSign = [1, 1, 1];
    const iso = computeGridSpace(points, normalizedConfig, isolated);
    expect(iso.CENTER.x).toBe(55.5);
  });
});

describe("toRenderSpace", () => {
  it("maps data-zero to the box center for the full (non-isolated) grid", () => {
    const points = [point(100, 100, 100)];
    const space = computeGridSpace(points, normalizedConfig, null);
    const [rx, ry, rz] = space.toRenderSpace(point(0, 0, 0));
    expect(rx).toBeCloseTo(0, 10);
    expect(ry).toBeCloseTo(0, 10);
    expect(rz).toBeCloseTo(0, 10);
  });

  it("maps the axis's max data value to the render box's GRID_MAX wall", () => {
    const points = [point(100, 0, 0)];
    const space = computeGridSpace(points, normalizedConfig, null);
    const [rx] = space.toRenderSpace(point(111, 0, 0));
    expect(rx).toBeCloseTo(GRID_MAX, 10);
  });

  it("maps the axis's min data value to the render box's GRID_MIN wall", () => {
    const points = [point(100, 0, 0)];
    const space = computeGridSpace(points, normalizedConfig, null);
    const [rx] = space.toRenderSpace(point(-111, 0, 0));
    expect(rx).toBeCloseTo(GRID_MIN, 10);
  });
});

describe("ZERO_RENDER", () => {
  it("is the box center [0,0,0]-equivalent (via SCALE) for the full grid", () => {
    const points = [point(100, 100, 100)];
    const space = computeGridSpace(points, normalizedConfig, null);
    expect(space.ZERO_RENDER.x).toBeCloseTo(0, 10);
  });

  it("moves to a box wall when isolated, since data-zero is no longer the range center", () => {
    const points = [point(100, 100, 100)];
    const isolated: OctantSign = [1, 1, 1];
    const space = computeGridSpace(points, normalizedConfig, isolated);
    const expectedScale = (GRID_MAX - GRID_MIN) / 111;
    expect(space.ZERO_RENDER.x).toBeCloseTo(-55.5 * expectedScale, 10);
    expect(space.ZERO_RENDER.x).not.toBeCloseTo(0, 5);
  });
});

describe("inOctant", () => {
  it("returns true for every point when no octant is isolated (null)", () => {
    expect(inOctant(point(-5, -5, -5), null)).toBe(true);
    expect(inOctant(point(5, 5, 5), null)).toBe(true);
  });

  it("assigns a point exactly at 0 to the POSITIVE side on every axis", () => {
    const zero = point(0, 0, 0);
    expect(inOctant(zero, [1, 1, 1])).toBe(true);
    expect(inOctant(zero, [-1, 1, 1])).toBe(false);
    expect(inOctant(zero, [1, -1, 1])).toBe(false);
    expect(inOctant(zero, [1, 1, -1])).toBe(false);
  });

  it("correctly filters a point outside the selected octant", () => {
    const p = point(50, -50, 10);
    expect(inOctant(p, [1, 1, 1])).toBe(false);
    expect(inOctant(p, [1, -1, 1])).toBe(true);
  });

  it("partitions the 8 octants with no point counted twice (boundary values only ever satisfy one sign per axis)", () => {
    const p = point(0, 5, -5);
    expect(inOctant(p, [1, 1, -1])).toBe(true);
    expect(inOctant(p, [-1, 1, -1])).toBe(false);
  });
});

describe("GRID_MIN / GRID_MAX", () => {
  it("are configured with min strictly less than max", () => {
    expect(GRID_MIN).toBeLessThan(GRID_MAX);
  });
});
