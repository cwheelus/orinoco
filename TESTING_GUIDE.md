# Testing Guide

This document complements [README.md](README.md) (project overview, features, architecture) and [USER_GUIDE.md](USER_GUIDE.md) (analyst-facing usage). This guide is for anyone writing, running, or extending the automated test suite, or investigating a diagnostic code.

**Contents**

- [Purpose & QA philosophy](#purpose--qa-philosophy)
- [Test taxonomy](#test-taxonomy)
- [Setup](#setup)
- [How to run automated verification](#how-to-run-automated-verification)
- [The fixture-size pitfall](#the-fixture-size-pitfall)
- [Colors.csv semantic validation](#colorscsv-semantic-validation)
- [Inverted numeric range](#inverted-numeric-range)
- [Parser interpretation / small-file classification](#parser-interpretation--small-file-classification)
- [Manual QA matrix](#manual-qa-matrix)
- [Regression risk areas](#regression-risk-areas)
- [Fixture library reference](#fixture-library-reference)
- [Documentation audit](#documentation-audit)
- [Error code reference](#error-code-reference)
- [Adding a new test](#adding-a-new-test)
- [Troubleshooting](#troubleshooting)
- [What's NOT covered by this suite](#whats-not-covered-by-this-suite-and-why)
- [Current coverage](#current-coverage)
- [Verification session](#verification-session)

---

## Purpose & QA philosophy

This is regression and fault-finding documentation, not just a list of what `npm test` runs.

A discovered fault is reproduced first, fixed in production code, then protected by regression coverage. Tests must not be written merely to encode existing behavior when that behavior is defective — if a test's assertions match a bug rather than the intended fix, the test is wrong, not the bug report.

Every fault documented in this guide follows the same sequence:

```
DISCOVER
  |
REPRODUCE
  |
RECORD EXPECTED vs ACTUAL
  |
FIX PRODUCTION CODE
  |
RUN EXISTING REGRESSION SUITE
  |
MANUALLY VERIFY INTEGRATION
  |
ADD REGRESSION COVERAGE
  |
DOCUMENT THE FIX
```

A failing test should never be made to pass by loosening its assertions instead of fixing the underlying code — that defeats the purpose of the sequence above.

---

## Test taxonomy

The six categories below define how testing evidence and findings are classified throughout this guide.

| Category                   | Meaning                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regression Test**        | An automated test (`npm test`) proving an existing, correct behavior continues to hold.                                                                               |
| **Fault Reproduction**     | A minimal, concrete case demonstrating a real defect existed, before any fix.                                                                                         |
| **Fix Verification**       | Evidence — automated or manual — that production code now behaves correctly after a fix.                                                                              |
| **Diagnostic Expectation** | A statement of which Console code/severity/message should appear for a given scenario.                                                                                |
| **Manual Verification**    | Confirmed by hand in the running application, because the behavior involves integration/lifecycle concerns unit tests cannot reach (React state, load order, timing). |
| **Known Unresolved**       | A gap that is documented but intentionally not fixed, pending a decision.                                                                                             |

A failing test is not necessarily a product defect. If the expected behavior itself is still awaiting a design decision, the test belongs under Known Unresolved rather than being treated as evidence of a production defect — see [Parser interpretation / small-file classification](#parser-interpretation--small-file-classification).

---

## Setup

```bash
npm install
```

Vitest must use the `jsdom` test environment, configured in `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

`parseCSV.ts` and `parseColorsCSV.ts` both parse a browser `File` object via PapaParse's file-streaming path, which uses `FileReaderSync` — a Web Worker/browser API with no Node equivalent. Running under Vitest's default `node` environment throws `ReferenceError: FileReaderSync is not defined` on every test touching either parser. Do not revert `environment` to `"node"` — see [Troubleshooting](#troubleshooting).

---

## How to run automated verification

```bash
npm run build   # TypeScript compiles, Vite bundles - proves the code is syntactically and structurally valid
npm test        # runs the Vitest suite - proves pure logic behaves as documented
npm run lint    # oxlint - proves style/convention compliance
```

`npm test` proves that the pure-function layer — CSV/color-file parsing, column classification, numeric filter evaluation, display truncation, and the color-override comparison logic — behaves exactly as its assertions state.

`npm test` does not prove:

- That the React components consuming this logic wire it up correctly (state selectors, `useEffect` timing, handler call order)
- That the Console actually displays the diagnostic a given scenario is supposed to produce
- That anything renders correctly on screen (layout, truncation appearance, camera behavior)

Scenarios requiring integration or lifecycle behavior are explicitly marked Manual Verification throughout this guide. `npm test` passing should never be represented as covering them.

---

## The fixture-size pitfall

Column classification (`classifyColumns` in `parseCSV.ts`) uses a threshold ratio, not a fixed count: a column is numeric if `numericCount / sampledCount >= NUMERIC_THRESHOLD` (0.9 by default, from `config.json`).

A 3-row fixture with 1 bad value puts that column at 2/3 = 66.7%, below threshold, so the column is reclassified as text before row-level validation ever runs. A test expecting a row to be skipped will instead see the whole column silently excluded, and fail in a way that resembles a parser defect but is a fixture-design error.

Rule: testing row-level skip behavior requires fixtures with 10 or more rows, so a single bad value stays above the 90% threshold. Testing the classification boundary itself uses small, precisely-calibrated fixtures deliberately (for example, 45/50 vs. 44/50) — that is a distinct, intentional case and should not be imitated when testing row-level behavior.

See `parseCSV.test.ts`'s `describe("ParseResult.interpretation")` block for small- and large-fixture examples side by side, with comments explaining the distinction.

---

## Colors.csv semantic validation

### Original fault

`parseColorsCSV.ts` has no way to determine whether a class name is a typo — it only ever processes the color file in isolation, independent of the loaded dataset. A misspelled override (for example, `"nomal"` instead of `"normal"`) parsed successfully, applied as a valid override, and produced no indication that it never matched any class in the dataset.

### Fault reproduction

```
className,color
nomal,#dddddd
nss,#dd0000
```

Loaded against a dataset with classes `normal, nss, qc, zt`. Before the fix, `CLR-100 Color mapping loaded` fired — identical to a fully correct file, with no distinguishing signal.

### Production fix

- A pure function `getUnmatchedColorOverrides(overrides, availableClasses)` in `src/lib/colorValidation.ts`, kept separate from `classColors.ts` (which resolves a single color and has no dataset concept)
- Two additional diagnostic codes: `CLR-051` (unmatched class, warning) and `CLR-101` (validation deferred, info) — see [Error code reference](#error-code-reference)
- `App.tsx` validates at both load points: `handleColorFileSelected` validates immediately if a dataset is already loaded, or defers with `CLR-101` if not; `handleFileSelected` re-validates any existing overrides against every newly loaded dataset
- Diagnostics remain historical: an earlier `CLR-051` is not retroactively cleared when a later dataset resolves the mismatch

### Case sensitivity — current implementation behavior

`availableClasses` stores the raw `className` values from the parsed dataset (for example, `nss`, lowercase), while the Legend and other UI surfaces display them uppercase via CSS only (`text-transform: uppercase` / Tailwind's `uppercase` class). The comparison in `getUnmatchedColorOverrides` is case-sensitive, matching the raw stored value rather than the displayed one.

This is documented as the current implementation contract, not a reviewed product requirement — no decision has been made on whether color overrides should match case-insensitively. The regression test described below locks in the current behavior so that any future change to it is a deliberate, visible decision rather than an incidental side effect of unrelated work.

Observed in the running application: a color override of `nss` (lowercase) matched a dataset whose `className` values are lowercase, despite the Legend displaying `NSS`. An override of `NSS` (uppercase) against the same dataset would not match under the current implementation.

### Automated pure-function coverage

**Regression Test** — `colorValidation.test.ts` (8 tests): full match, single typo, multiple typos, an empty-`availableClasses` case, an empty-overrides case, case sensitivity, a no-mutation check, and re-validation of the same overrides against two different class lists in sequence, which proves the comparison itself retains no state between calls.

This automated coverage proves the comparison logic is correct. It does not prove that `App.tsx` calls it at the correct times, in the correct order, or logs the correct diagnostic — that is Manual Verification, below.

### Manual verification

Every row of the [load-order matrix](#manual-qa-matrix) below was exercised directly in the running application, with the resulting Console entries recorded.

Exact Console detail recorded for the malformed-row plus unmatched-class case (dataset loaded, then colors with both a malformed row and an unmatched class):

```
CLR-051 UNMATCHED CLASS OVERRIDE
1 of 2 color override(s) don't match any loaded class.
Unmatched (check for typos): normal
Loaded dataset classes: nomal, nss

CLR-050 Color rows excluded
colors-step4-malformed-and-mismatch.csv: applied 2 color override(s), excluded 1 row(s).
```

Both codes fired as separate, independent Console entries, confirming that the earlier single-branch `if`/`else` structure — which could only ever surface one of the two problems — no longer suppresses either finding.

### Diagnostic expectations

See the [Error code reference](#error-code-reference) for the full `CLR-0xx`/`CLR-1xx` definitions.

---

## Inverted numeric range

### Original fault

The "between" numeric filter (`passesNumeric` in `src/components/PointCloud.tsx`) applied both bounds independently: `value >= min AND value <= max`. If the minimum and maximum values were entered in reversed order (for example, min = 20, max = 10), no value could satisfy both conditions simultaneously. Every point was silently excluded from the plot, with no error or warning distinguishing this from a filter that legitimately matched nothing.

### Reproduction

```ts
const f = { op: "between", value: "20", value2: "10" };
passesNumeric(15, f); // returned false; expected true, since 15 falls between 10 and 20
```

### Fixed behavior

When both bounds parse successfully and `min > max`, the function now treats the smaller value as the floor and the larger as the ceiling, rather than applying the two bounds literally in the order they were entered.

### Regression coverage

**Regression Test** — `passesNumeric.test.ts` includes a dedicated case asserting the corrected behavior: values inside `[10, 20]` (inclusive at both ends) pass regardless of which input held which number; values outside the range still correctly fail.

### Manual verification

Not separately verified in the running application. `passesNumeric` is a pure function with no React or store dependency in its logic path, and its behavior is fully exercised by the automated regression test above. Consistent with this guide's taxonomy, a pure-function defect with a pure-function fix does not require a manual walkthrough to be considered verified.

---

## Parser interpretation / small-file classification

### What was reproduced

Confirmed with fixture files in the running application:

| File shape                                | Ratio for the affected column | Result                                                                                                                                 |
| ----------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 3 rows, 1 invalid value in one column     | 2/3 = 67%                     | The column is reclassified as text; the dataset loads as 2D using the remaining numeric columns; no warning is produced                |
| 10 rows, 1 invalid value in one column    | 9/10 = 90%                    | The column remains numeric; the single invalid row is skipped with a `CSV-050` warning naming the affected cell                        |
| 3 rows, every value in one column invalid | 0/3 = 0%                      | Now reported: `Column "y": text (0/3 sampled values numeric)` appears in the `CSV-100` Console entry, same as any partial-failure case |

Fix applied: `parseCSV.ts`'s `ParseInterpretation` contract reports, on every successful load, which columns were classified as text and why — their numeric ratio and example invalid values. This part was never in question.

### Resolution — classification vs. reporting

Two separable questions existed here, and only one was actually open:

1. **Should the 90% classification threshold itself change** (e.g. become more lenient for small files)? This was never implemented and remains untouched — `classifyColumns`'s threshold-based logic is exactly as it was. Confirmed with the team as the intended behavior: users are responsible for validating and cleaning data before upload; the app should not try to infer intent or compensate for ambiguous small files.

2. **Should a column at 0% numeric be reported, the same way a partial-failure column already is?** This was the actual open question, and it is now resolved: yes. `App.tsx`'s `interpretationDetails` filter no longer requires `numericCount > 0` — every text column beyond `uid`/`class` is now reported, including columns with zero numeric signal. A 0%-numeric column now produces a Console note (`Column "y": text (0/N sampled values numeric)`) rather than logging identically to a clean file.

**Net effect:** classification behavior is unchanged (a column can still silently become "just text" if it misses the threshold), but _reporting_ is now unconditional — a successful load never omits mention of a text column's presence and ratio, regardless of how severe the mismatch is. This was confirmed directly with the team: informing the analyst should never depend on severity.

---

## Manual QA matrix

This is the authoritative record for colors.csv load-order behavior. Every row was exercised manually in the running application; only the comparison logic behind it is covered by automated tests.

The pure validation helper (`getUnmatchedColorOverrides`) is automated via `colorValidation.test.ts`. The React load-order behavior and the resulting Console diagnostics are integration behavior, currently verified manually. `npm test` does not cover this matrix end to end.

| Load order                        | Condition                                    | Expected diagnostic                                                     | Verification                                           |
| --------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Dataset, then colors              | All classes match                            | `CLR-100`                                                               | Manual; automated comparison logic                     |
| Dataset, then colors              | Unmatched class                              | `CLR-051` warning                                                       | Manual; automated comparison logic                     |
| Dataset, then colors              | Malformed row                                | `CLR-050` warning                                                       | Manual; parsing covered by `parseColorsCSV.test.ts`    |
| Dataset, then colors              | Malformed row and unmatched class            | `CLR-050` and `CLR-051` both fire, independently                        | Manual — see exact Console text above                  |
| Colors, no dataset loaded         | Valid overrides                              | `CLR-101` info (not a warning)                                          | Manual                                                 |
| Colors, then dataset loaded later | All classes match                            | No new warning logged                                                   | Manual                                                 |
| Colors, then dataset loaded later | Unmatched class                              | `CLR-051` fires from the dataset-load handler                           | Manual; automated comparison logic                     |
| Dataset A, then Dataset B         | Class unmatched against A becomes valid in B | No new warning; the earlier `CLR-051` from A remains in Console history | Manual; automated comparison logic (revalidation test) |
| Dataset A, then Dataset B         | Class valid against A becomes unmatched in B | New `CLR-051` fires                                                     | Manual                                                 |

---

## Regression risk areas

If a change touches one of these files, re-run the corresponding suite (and, where noted, manually re-check the matrix above) before merging.

| If you touch...                                               | Re-run                                                                                                 | Because                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classifyColumns` or the numeric threshold in `parseCSV.ts`   | `parseCSV.test.ts` in full, especially the `ParseResult.interpretation` block                          | The ordering between column classification and row validation is what produced the fixture-size pitfall — small changes here can silently alter which errors small files produce |
| `passesNumeric` in `PointCloud.tsx`                           | `passesNumeric.test.ts`                                                                                | This function previously shipped a real defect (the inverted range) with no other safety net besides this suite                                                                  |
| `handleColorFileSelected` / `handleFileSelected` in `App.tsx` | The full [Manual QA matrix](#manual-qa-matrix), by hand — these handlers are not covered by `npm test` | This is integration code; `colorValidation.test.ts` proves only that the comparison function is correct, not that these handlers call it correctly or in the right order         |
| `errorCodes.ts`                                               | Search every file referencing the code being changed before renumbering or removing anything           | Codes are append-only by convention; a renumbered code silently breaks any test asserting against the old value                                                                  |
| `truncateLabel.ts`                                            | `truncateLabel.test.ts`, then visually re-check `Axes.tsx` and the Legend                              | The function is pure and tested, but its call sites have had real layout defects (overflow, incorrect wrap direction) that no unit test would catch                              |

---

## Fixture library reference

Non-trivial fixtures used during manual verification, for reuse or reference. All are small, self-contained CSVs.

| Purpose                            | Shape                                                                              | Used for                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Small-file classification boundary | 3 rows, 1 invalid value in one numeric-looking column (67%)                        | Reproducing the silent 2D-reclassification fault                                               |
| Small-file total failure           | 3 rows, every value in one column invalid (0%)                                     | Confirming the 0%-numeric case is indistinguishable from ordinary metadata                     |
| Row-skip isolation                 | 10 rows, 1 invalid value in one column (90%, at threshold)                         | Proving row-level skip works correctly once a column remains classified numeric                |
| Scattered multi-column failure     | 3 rows, 1 invalid value each in two different numeric-looking columns              | Reproducing `CSV-002` firing due to column reclassification, with per-column diagnostic detail |
| Colors: typo case                  | `className,color` with one misspelled class name, one valid                        | The colors.csv semantic-validation fault and fix                                               |
| Colors: revalidation case          | Two sequential dataset loads, one where a previously unmatched class becomes valid | Proving fresh re-validation rather than a stale blacklist                                      |
| Colors: malformed plus mismatch    | `className,color` with one non-hex color value and one unmatched class name        | Proving `CLR-050` and `CLR-051` fire independently                                             |
| Long-name truncation               | Column headers 25+ characters, some with underscores                               | Verifying the 8-character truncation specification and the axis-label collision fix            |

---

## Documentation audit

Items identified that are not product defects, tracked separately from the fault-tracking sections above.

| Item                                                                                                              | Note                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README's "Test Data" section described `sample-data/mixed-sign-sample.csv` as "loaded automatically on app start" | Resolved by #57 — the startup auto-load and the bundled dataset are both gone, and that README section now documents the error-case fixtures instead. Historical note only. |
| Two `__tests__` folders existed during initial test-suite setup                                                   | Resolved — all tests are consolidated into `src/lib/__tests__/`. Documented here as a historical note only.                                                                 |

---

## Error code reference

Every diagnostic is registered in `src/lib/errorCodes.ts` as a stable `{ code, severity, title }` triple. Codes are append-only and are never renumbered or reused.

Format: `<SUBSYSTEM>-<NUMBER>` — `0xx` = error, `05x` = warning, `1xx` = info.

### CSV subsystem

| Code      | Constant              | Severity | Title                   |
| --------- | --------------------- | -------- | ----------------------- |
| `CSV-001` | `CSV_EMPTY`           | error    | Empty file              |
| `CSV-002` | `CSV_TOO_FEW_NUMERIC` | error    | Too few numeric columns |
| `CSV-003` | `CSV_NO_TEXT_COLUMNS` | error    | No label column         |
| `CSV-004` | `CSV_NO_VALID_ROWS`   | error    | No valid rows           |
| `CSV-005` | `CSV_PARSE_FAILED`    | error    | Parse failed            |
| `CSV-006` | `CSV_FETCH_FAILED`    | error    | Dataset fetch failed    |
| `CSV-007` | `CSV_NOT_CSV`         | error    | Not a CSV file          |
| `CSV-050` | `CSV_ROWS_SKIPPED`    | warning  | Rows excluded           |
| `CSV-100` | `CSV_LOADED`          | info     | Dataset loaded          |
| `CSV-101` | `CSV_REMAPPED`        | info     | Axis mapping changed    |

### CLR subsystem

| Code      | Constant                  | Severity | Title                       |
| --------- | ------------------------- | -------- | --------------------------- |
| `CLR-001` | `CLR_EMPTY`               | error    | Empty color file            |
| `CLR-002` | `CLR_MISSING_HEADERS`     | error    | Missing required columns    |
| `CLR-003` | `CLR_NO_VALID_PAIRS`      | error    | No usable class/color pairs |
| `CLR-004` | `CLR_PARSE_FAILED`        | error    | Color file parse failed     |
| `CLR-050` | `CLR_ROWS_SKIPPED`        | warning  | Color rows excluded         |
| `CLR-051` | `CLR_UNMATCHED_CLASS`     | warning  | Unmatched class override    |
| `CLR-100` | `CLR_LOADED`              | info     | Color mapping loaded        |
| `CLR-101` | `CLR_VALIDATION_DEFERRED` | info     | Color validation deferred   |

### Catch-all

| Code      | Constant         | Severity | Title                                                                                                                                         |
| --------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP-001` | `APP_UNEXPECTED` | error    | Unexpected error — anything thrown that is not a coded `AppError`. Recurring occurrences indicate the underlying cause warrants its own code. |

### AppError and helpers

`AppError` is a plain `Error` with `appCode` and `detail` attached at runtime, rather than a subclass. Subclassed built-ins are a known source of `instanceof` failures under transpilation; a plain `Error` with attached fields keeps existing `instanceof Error` checks working unchanged.

| Function                              | Purpose                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `appError(appCode, message, detail?)` | Constructs an `AppError`                                                                             |
| `isAppError(err)`                     | Type guard                                                                                           |
| `describeError(err, fallbackMessage)` | Narrows a caught value to `{ appCode, message, detail? }`; anything uncoded becomes `APP_UNEXPECTED` |

Testing convention: assert `error.appCode?.code === CODES.SOME_CODE.code`, not the message text, so wording changes do not break tests that do not depend on the exact sentence.

---

## Adding a new test

1. All tests live in `src/lib/__tests__/`, one file per source file tested, regardless of which `src/` subfolder the source file lives in (for example, `passesNumeric.test.ts` tests a function from `src/components/PointCloud.tsx`, but still resides in `src/lib/__tests__/`). Tests are centralized in one location rather than colocated per directory.
2. `describe`, `it`, and `expect` are global (`globals: true` in `vitest.config.ts`).
3. Build `File` objects from raw strings for parser tests rather than reading fixtures from disk.
4. Assert against `appCode.code`, not message text.
5. Review [The fixture-size pitfall](#the-fixture-size-pitfall) before writing any threshold-adjacent fixture.
6. Label new findings with the correct [taxonomy category](#test-taxonomy).
7. Run `npm test` before committing.

---

## Troubleshooting

| Symptom                                                                                                      | Cause                                                                                          | Fix                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ReferenceError: FileReaderSync is not defined`, many failures at once                                       | `environment` set to `"node"` instead of `"jsdom"`                                             | Set `environment: "jsdom"` in `vitest.config.ts`                                                           |
| A test expecting a row skip instead sees the whole column excluded                                           | Fixture too small — see [fixture-size pitfall](#the-fixture-size-pitfall)                      | Use 10 or more rows unless deliberately testing the classification boundary                                |
| `Missing script: "test"`                                                                                     | The current branch does not have the test infrastructure                                       | Confirm the active branch and switch if necessary                                                          |
| Code or behavior is documented as applied, but the running application or `npm test` shows previous behavior | The change was not actually saved, or the development server/browser is serving a cached build | Confirm the change is present in the source file; hard-refresh the browser; restart the development server |
| `npm run build` fails with an unresolved import                                                              | A helper function is referenced but not imported at the call site                              | Confirm every referenced name has a matching import                                                        |
| A test's expected value is off by a character or an unusual split                                            | The expected value was derived by hand and does not match the actual algorithm                 | Re-derive the expected value from the implementation itself                                                |
| Two `__tests__` folders exist                                                                                | A test was created colocated with its source file rather than in the centralized location      | Move the file into `src/lib/__tests__/` — see [Adding a new test](#adding-a-new-test)                      |

---

## What's NOT covered by this suite (and why)

| Area                                | Why                                                                                                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D scene rendering                  | Requires a headless WebGL/browser setup (for example, Playwright); not currently in scope                                                                                                                                          |
| Camera behavior (`CameraRig.tsx`)   | Entangled with Three.js per-frame state, not isolated into pure functions                                                                                                                                                          |
| React component rendering generally | `@testing-library/react` and jsdom are available but unused for component rendering; `passesNumeric` and `truncateLabel` were extracted specifically so their logic could be tested without rendering the components that use them |
| Visual/layout defects               | Identified and corrected through manual browser testing; Vitest does not render pixels                                                                                                                                             |
| Zustand store actions individually  | Mostly thin wrappers around already-tested logic                                                                                                                                                                                   |

A passing `npm test` run does not indicate the application is fully verified — see [How to run automated verification](#how-to-run-automated-verification).

---

## Current coverage

| File                      | Tests | Covers                                                                                                                                               |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseCSV.test.ts`        | 22    | Column classification, malformed-file rejection, row-skip behavior, the `ParseInterpretation` contract, axis-mapping behavior                        |
| `parseColorsCSV.test.ts`  | 15    | Header matching, malformed-row handling, the colors.csv typo scenario                                                                                |
| `truncateLabel.test.ts`   | 9     | The 8-character display-truncation specification                                                                                                     |
| `passesNumeric.test.ts`   | 16    | Numeric filter evaluation, including the inverted-range fix                                                                                          |
| `colorValidation.test.ts` | 8     | Color-override comparison logic, including fresh re-validation across dataset changes                                                                |
| `errorCodes.test.ts`      | 7     | The `isAppError` shape guard (including the realm-agnostic structural check) and `describeError`'s APP-001 fallback (#58)                            |
| `logIds.test.ts`          | 4     | Console log-id monotonicity across clears and ring-buffer trimming (#58)                                                                             |
| `gridSpace.test.ts`       | 24    | `computeGridSpace`'s three scaling modes, octant isolation, `toRenderSpace`, `ZERO_RENDER`, and `inOctant`'s zero-boundary partitioning (#64 Tier 1) |

105 tests total.

---

## Verification session

The content in this guide reflects testing performed against the actual source files and the running application at the time of writing. Automated test counts, error codes, and code excerpts were checked directly against source rather than reconstructed from memory. Manual-verification claims — the load-order matrix and the exact Console text quoted above — were observed directly in the running application.

Future updates to this guide should preserve this discipline: verify claims against current source and application behavior before recording them, rather than carrying forward assumptions from an earlier version of this document.
