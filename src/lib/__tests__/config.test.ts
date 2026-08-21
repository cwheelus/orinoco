import { describe, expect, it } from "vitest";
import { config, validate, type AppConfig } from "../config";

/**
 * config.test.ts
 *
 * Covers #64 Tier 1's "config.ts validation" item. The issue listed
 * this as blocked because validate() was module-private; it is now
 * exported (see config.ts's comment on why that is safe), so each rule
 * can be exercised against a synthetic config instead of by shipping a
 * deliberately broken config.json.
 *
 * HOW THESE TESTS ARE BUILT. Every case starts from the REAL config —
 * `broken(mutate)` deep-clones config.json's loaded value and applies
 * one mutation — so a suite that passes proves two things at once: the
 * rule rejects the bad value, and it does so for a config that is
 * otherwise exactly what the app ships. It also means these tests
 * cannot drift into asserting against a hand-written fixture that no
 * longer resembles the real file.
 *
 * Each case asserts on the MESSAGE, not just that something threw,
 * because validate() aggregates every problem into one error: an
 * assertion of `toThrow()` alone would pass even if a completely
 * different rule were the one that fired.
 */

/** A clone of the shipped config with one deliberate defect applied. */
function broken(mutate: (c: AppConfig) => void): AppConfig {
  const clone = structuredClone(config);
  mutate(clone);
  return clone;
}

/** Asserts validate() rejects `c`, and that it does so for `reason`. */
function expectRejected(c: AppConfig, reason: RegExp) {
  expect(() => validate(c)).toThrow(reason);
}

describe("validate - the shipped config.json", () => {
  it("accepts the config the app actually ships", () => {
    // config.ts already runs this at import time, so a regression here
    // would break every suite — asserting it explicitly names the
    // failure instead of leaving it as a mysterious import error.
    expect(() => validate(config)).not.toThrow();
  });
});

describe("validate - data section", () => {
  it("rejects a numericThreshold of 0 (no column could ever qualify)", () => {
    expectRejected(
      broken((c) => {
        c.data.numericThreshold = 0;
      }),
      /numericThreshold must be between 0 and 1/,
    );
  });

  it("rejects a numericThreshold above 1 (an unreachable fraction)", () => {
    expectRejected(
      broken((c) => {
        c.data.numericThreshold = 1.5;
      }),
      /numericThreshold must be between 0 and 1/,
    );
  });

  it("accepts a numericThreshold of exactly 1 (every sampled cell must parse)", () => {
    expect(() =>
      validate(
        broken((c) => {
          c.data.numericThreshold = 1;
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a non-positive typeSampleSize", () => {
    expectRejected(
      broken((c) => {
        c.data.typeSampleSize = 0;
      }),
      /data\.typeSampleSize must be a positive number/,
    );
  });

  it("rejects minNumericColumns below 2, since a plot needs two axes", () => {
    expectRejected(
      broken((c) => {
        c.data.minNumericColumns = 1;
      }),
      /minNumericColumns must be at least 2/,
    );
  });

  it("rejects an empty classNameHeaders list", () => {
    expectRejected(
      broken((c) => {
        c.data.colorFile.classNameHeaders = [];
      }),
      /classNameHeaders must list at least one header name/,
    );
  });

  it("rejects an empty colorHeaders list", () => {
    expectRejected(
      broken((c) => {
        c.data.colorFile.colorHeaders = [];
      }),
      /colorHeaders must list at least one header name/,
    );
  });

  it("rejects a colorPattern that is not a compilable regex", () => {
    expectRejected(
      broken((c) => {
        c.data.colorFile.colorPattern = "^#([0-9a-f{6}$";
      }),
      /colorPattern is not a valid regular expression/,
    );
  });

  it("accepts a widened but valid colorPattern", () => {
    expect(() =>
      validate(
        broken((c) => {
          c.data.colorFile.colorPattern =
            "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$";
        }),
      ),
    ).not.toThrow();
  });
});

describe("validate - grid section", () => {
  it("rejects an inverted box range", () => {
    expectRejected(
      broken((c) => {
        c.grid.boxMin = 2;
        c.grid.boxMax = -2;
      }),
      /grid\.boxMin\/boxMax: min must be less than max/,
    );
  });

  it("rejects a box whose min and max are equal (zero-volume grid)", () => {
    expectRejected(
      broken((c) => {
        c.grid.boxMin = 2;
        c.grid.boxMax = 2;
      }),
      /grid\.boxMin\/boxMax: min must be less than max/,
    );
  });

  it("rejects a non-positive planeStep", () => {
    expectRejected(
      broken((c) => {
        c.grid.planeStep = 0;
      }),
      /grid\.planeStep must be a positive number/,
    );
  });

  it("rejects a negative rangeMargin", () => {
    expectRejected(
      broken((c) => {
        c.grid.rangeMargin = -0.1;
      }),
      /grid\.rangeMargin cannot be negative/,
    );
  });

  it("accepts a rangeMargin of 0 (walls flush with the data's extremes)", () => {
    expect(() =>
      validate(
        broken((c) => {
          c.grid.rangeMargin = 0;
        }),
      ),
    ).not.toThrow();
  });
});

describe("validate - points section", () => {
  it("rejects a NaN baseRadius, the failure that silently drops every point", () => {
    expectRejected(
      broken((c) => {
        c.points.baseRadius = Number.NaN;
      }),
      /points\.baseRadius must be a positive number/,
    );
  });

  it("rejects a non-positive referenceCount", () => {
    expectRejected(
      broken((c) => {
        c.points.referenceCount = 0;
      }),
      /points\.referenceCount must be a positive number/,
    );
  });

  it("rejects an inverted auto radius range", () => {
    expectRejected(
      broken((c) => {
        c.points.autoMinRadius = 0.5;
        c.points.autoMaxRadius = 0.01;
      }),
      /points\.autoMinRadius\/autoMaxRadius: min must be less than max/,
    );
  });

  it("rejects an inverted hard radius range", () => {
    expectRejected(
      broken((c) => {
        c.points.hardMinRadius = 1;
        c.points.hardMaxRadius = 0.5;
      }),
      /points\.hardMinRadius\/hardMaxRadius: min must be less than max/,
    );
  });

  it("rejects fewer than 3 sphere segments, which cannot form a solid", () => {
    expectRejected(
      broken((c) => {
        c.points.sphereSegments = 2;
      }),
      /sphereSegments must be at least 3/,
    );
  });
});

describe("validate - axes section", () => {
  it("rejects a non-positive referenceDistance", () => {
    expectRejected(
      broken((c) => {
        c.axes.referenceDistance = 0;
      }),
      /axes\.referenceDistance must be a positive number/,
    );
  });

  it("rejects an inverted screen-scale clamp", () => {
    expectRejected(
      broken((c) => {
        c.axes.minScreenScale = 5;
        c.axes.maxScreenScale = 0.15;
      }),
      /axes\.minScreenScale\/maxScreenScale: min must be less than max/,
    );
  });

  it("rejects negative decimalPlaces", () => {
    expectRejected(
      broken((c) => {
        c.axes.decimalPlaces = -1;
      }),
      /axes\.decimalPlaces cannot be negative/,
    );
  });
});

describe("validate - camera section", () => {
  it("rejects an inverted zoom range, which would make the camera unusable", () => {
    expectRejected(
      broken((c) => {
        c.camera.minZoomDistance = 18;
        c.camera.maxZoomDistance = 0.15;
      }),
      /camera\.minZoomDistance\/maxZoomDistance: min must be less than max/,
    );
  });

  it("rejects a zero minZoomDistance", () => {
    expectRejected(
      broken((c) => {
        c.camera.minZoomDistance = 0;
      }),
      /camera\.minZoomDistance must be a positive number/,
    );
  });

  it("rejects a non-positive panReferenceDistance", () => {
    expectRejected(
      broken((c) => {
        c.camera.panReferenceDistance = -5;
      }),
      /camera\.panReferenceDistance must be a positive number/,
    );
  });

  it("rejects an initialPosition that is not exactly 3 numbers", () => {
    expectRejected(
      broken((c) => {
        // The tuple type forbids this at compile time; the cast
        // reproduces what a hand-edited config.json can still do at
        // runtime, which is exactly what this rule exists to catch.
        (c.camera as { initialPosition: number[] }).initialPosition = [5, 4];
      }),
      /camera\.initialPosition must have exactly 3 numbers/,
    );
  });
});

describe("validate - console section", () => {
  it("rejects a non-positive maxEntries", () => {
    expectRejected(
      broken((c) => {
        c.console.maxEntries = 0;
      }),
      /console\.maxEntries must be a positive number/,
    );
  });

  it("rejects a non-positive maxListedRows", () => {
    expectRejected(
      broken((c) => {
        c.console.maxListedRows = -1;
      }),
      /console\.maxListedRows must be a positive number/,
    );
  });
});

describe("validate - sliders and their defaults", () => {
  it("rejects an inverted point-size slider range", () => {
    expectRejected(
      broken((c) => {
        c.limits.pointSizeSlider.min = 4;
        c.limits.pointSizeSlider.max = 0.25;
      }),
      /limits\.pointSizeSlider: min must be less than max/,
    );
  });

  it("rejects a zero slider step", () => {
    expectRejected(
      broken((c) => {
        c.limits.tickDensitySlider.step = 0;
      }),
      /limits\.tickDensitySlider\.step must be a positive number/,
    );
  });

  it("rejects a default point size outside its own slider's range", () => {
    expectRejected(
      broken((c) => {
        c.defaults.pointSizeScale = 10;
      }),
      /defaults\.pointSizeScale \(10\) is outside limits\.pointSizeSlider/,
    );
  });

  it("rejects a default tick density outside its own slider's range", () => {
    expectRejected(
      broken((c) => {
        c.defaults.tickDensity = 1;
      }),
      /defaults\.tickDensity \(1\) is outside limits\.tickDensitySlider/,
    );
  });

  it("accepts a default sitting exactly on a slider bound", () => {
    expect(() =>
      validate(
        broken((c) => {
          c.defaults.pointSizeScale = c.limits.pointSizeSlider.max;
          c.defaults.tickDensity = c.limits.tickDensitySlider.min;
        }),
      ),
    ).not.toThrow();
  });
});

describe("validate - point opacity", () => {
  it("rejects an opacity slider that reaches 0, which would hide the whole cloud", () => {
    expectRejected(
      broken((c) => {
        c.limits.pointOpacitySlider.min = 0;
      }),
      /limits\.pointOpacitySlider\.min must be greater than 0/,
    );
  });

  it("rejects an opacity slider that exceeds 1, which is not a valid alpha", () => {
    expectRejected(
      broken((c) => {
        c.limits.pointOpacitySlider.max = 2;
      }),
      /limits\.pointOpacitySlider\.max cannot exceed 1/,
    );
  });

  it("rejects a default opacity outside its own slider's range", () => {
    expectRejected(
      broken((c) => {
        c.defaults.pointOpacity = 0.01;
      }),
      /defaults\.pointOpacity \(0\.01\) is outside limits\.pointOpacitySlider/,
    );
  });

  it("accepts a fully opaque default", () => {
    expect(() =>
      validate(
        broken((c) => {
          c.defaults.pointOpacity = 1;
        }),
      ),
    ).not.toThrow();
  });
});

describe("validate - error reporting", () => {
  it("reports every problem in one throw, not just the first", () => {
    const c = broken((cfg) => {
      cfg.points.baseRadius = -1;
      cfg.grid.planeStep = 0;
      cfg.data.minNumericColumns = 0;
    });

    let message = "";
    try {
      validate(c);
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toMatch(/points\.baseRadius/);
    expect(message).toMatch(/grid\.planeStep/);
    expect(message).toMatch(/minNumericColumns/);
  });

  it("names the file and tells the reader what to do next", () => {
    expectRejected(
      broken((c) => {
        c.points.baseRadius = -1;
      }),
      /Invalid config\.json/,
    );
    expectRejected(
      broken((c) => {
        c.points.baseRadius = -1;
      }),
      /Fix the values above and reload/,
    );
  });

  it("reports the offending value, so the message identifies the bad key", () => {
    expectRejected(
      broken((c) => {
        c.points.baseRadius = -1;
      }),
      /got -1/,
    );
  });

  it("catches a key that is absent at runtime despite the type assertion", () => {
    // config.ts's header documents this hole: an ABSENT key survives
    // the `as AppConfig` assertion and arrives as undefined. The
    // positive/ordered checks are what actually catch it — this pins
    // that behavior so the documented guarantee stays true.
    expectRejected(
      broken((c) => {
        delete (c.points as Partial<AppConfig["points"]>).baseRadius;
      }),
      /points\.baseRadius must be a positive number \(got undefined\)/,
    );
  });
});
