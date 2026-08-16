# Orinoco — Project Build List

Record of implemented, tracked, and pending work. PR and issue data (author, closed/merged date, labels) verified directly against the repository's closed PR list and closed issues list. Where an issue explicitly links to the PR that closed it, both are cross-referenced.

Author attribution follows GitHub usernames: **makayo** (Mark), **dmerced05** (Daniel).

---

## Part 1 — Closed Pull Requests (shipped code)

| PR  | Author    | Merged/Closed                    | Labels                     | Summary                                                                                                                     |
| --- | --------- | -------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| #10 | dmerced05 | Jul 13                           | documentation              | README updated, YouTube demo added                                                                                          |
| #12 | makayo    | Jul 13                           | documentation              | Team workflow documentation                                                                                                 |
| #13 | makayo    | Jul 13                           | documentation              | Explanatory comments added to core components (closes #9)                                                                   |
| #14 | makayo    | Jul 14                           | enhancement                | Open-face Cartesian grid implemented with corrected axes                                                                    |
| #15 | dmerced05 | Jul 15                           | enhancement                | Grid centering and scaling adjustments                                                                                      |
| #17 | makayo    | last month                       | bug, documentation         | Axis labels corrected to match actual CSV columns                                                                           |
| #18 | makayo    | last month                       | documentation, enhancement | Reset-to-origin pivot button (closes #8)                                                                                    |
| #20 | dmerced05 | last month                       | enhancement                | Camera navigation redesign, data-anchored axis labels (closes #7)                                                           |
| #23 | dmerced05 | last month                       | bug                        | Fixed working cross/pivot marker                                                                                            |
| #29 | makayo    | last month                       | —                          | CSV loading system implemented                                                                                              |
| #30 | makayo    | last month                       | bug                        | Axis labels shown next to metric values in Point Analysis HUD                                                               |
| #31 | makayo    | last month                       | documentation              | README updated for CSV loader, Toolbar, grid toggle                                                                         |
| #32 | dmerced05 | last month                       | enhancement                | Instanced point rendering, count-adaptive sizing, data filters                                                              |
| #34 | makayo    | 3 weeks ago                      | enhancement                | Pan tool — click-and-drag view translation                                                                                  |
| #36 | makayo    | 3 weeks ago                      | enhancement                | Per-axis tick label visibility toggle                                                                                       |
| #37 | makayo    | 3 weeks ago                      | enhancement                | Desmos-style 3D grid mode — centered Y axis, zero-plane mode                                                                |
| #41 | makayo    | 3 weeks ago                      | documentation              | USER_GUIDE.md added (analyst-facing documentation)                                                                          |
| #42 | dmerced05 | 3 weeks ago                      | bug, enhancement           | Signed grid revised, octant isolation, CSV-only loading, navigation guardrails (6 of 7 tasks)                               |
| #44 | makayo    | 3 weeks ago                      | documentation              | USER_GUIDE.md rewritten for signed grid / octant isolation / CSV-only loading                                               |
| #45 | makayo    | 3 weeks ago                      | documentation              | README rewritten for signed grid / octant isolation / CSV-only loading                                                      |
| #51 | makayo    | 3 weeks ago                      | enhancement                | Manual light/dark mode toggle                                                                                               |
| #52 | makayo    | 2 weeks ago                      | enhancement                | Unlimited classes, colors.csv override, flexible numeric columns, 2D flat-plane, HUD metadata (closes #43)                  |
| #53 | makayo    | 2 weeks ago (closed, not merged) | documentation              | Cleanup of Copilot review comments from #52                                                                                 |
| #55 | makayo    | 2 weeks ago                      | enhancement                | Manual axis/column selection for datasets with 3+ numeric columns (closes #54)                                              |
| #56 | dmerced05 | 4 days ago                       | enhancement                | `config.json` deployment configuration; diagnostics Console with coded, severity-tiered log entries                         |
| #61 | dmerced05 | merged                           | bug                        | 2D dataset alignment — fixes the 3D bounding box incorrectly rendering in 2D dataset mode (closes #60)                      |
| #63 | makayo    | merged                           | bug, enhancement           | 2D camera lock — corrected camera snap axis, full 2D arrow-key navigation, resolved 6 Copilot-flagged findings (closes #62) |

---

## Part 2 — Closed Issues (tracked work, including any without a direct PR match)

25 of 29 total closed issues are accounted for below; the remaining 4 are not yet reconciled against available data (likely low-numbered, early foundational issues — see note at the end of this document).

| Issue | Author    | Closed  | Labels                      | Title                                                                                             | Linked PR  |
| ----- | --------- | ------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| #5    | dmerced05 | 3w ago  | enhancement                 | Camera guardrails implementation                                                                  | —          |
| #6    | dmerced05 | 1mo ago | enhancement                 | Implement the grid toggle mechanism                                                               | —          |
| #7    | dmerced05 | 1mo ago | enhancement, mvp-blocking   | Camera navigation changes                                                                         | #20        |
| #8    | dmerced05 | 1mo ago | enhancement                 | Add reset to origin button                                                                        | #18        |
| #9    | dmerced05 | Jul 13  | documentation               | Readability comments on code                                                                      | #13        |
| #11   | makayo    | Jul 13  | documentation               | Create team workflow documentation                                                                | —          |
| #16   | dmerced05 | 1mo ago | enhancement, mvp-blocking   | Implement CSV loading system (auto-detecting parser, dynamic grid/labels, toolbar file picker)    | likely #29 |
| #19   | makayo    | 3w ago  | documentation, mvp-blocking | Create user documentation for analysts                                                            | likely #41 |
| #21   | makayo    | 1mo ago | enhancement                 | Update Point Analysis panel labels to match renamed axes (E/C/W → orig-bytes/invel-pps/invel-bpp) | likely #30 |
| #22   | dmerced05 | 1mo ago | bug                         | Fix the lagging cross                                                                             | likely #23 |
| #24   | dmerced05 | 1mo ago | —                           | Zoom-based scaling with manual override                                                           | likely #42 |
| #25   | dmerced05 | 3w ago  | enhancement                 | Multiple axis scaling modes                                                                       | likely #42 |
| #26   | dmerced05 | 1mo ago | —                           | Large dataset performance and optimization                                                        | likely #32 |
| #27   | dmerced05 | 1mo ago | —                           | General filter by class and data value                                                            | likely #32 |
| #28   | dmerced05 | 3w ago  | enhancement                 | Desmos-style 3D grid mode                                                                         | #37        |
| #33   | makayo    | 3w ago  | enhancement                 | Add pan/drag tool to reposition view (hand tool)                                                  | #34        |
| #35   | makayo    | 3w ago  | enhancement                 | Add per-axis tick label visibility toggle                                                         | #36        |
| #38   | makayo    | 3w ago  | —                           | Enclosed box grid mode — third Grid modes option                                                  | likely #42 |
| #39   | dmerced05 | 3w ago  | —                           | Revamp of grid implementation for user end experience                                             | likely #42 |
| #40   | dmerced05 | 3w ago  | —                           | Remove data.json and instead for demo purposes auto load mixed sign dataset                       | likely #42 |
| #43   | dmerced05 | 2w ago  | enhancement                 | Allow for custom class amounts and color customization (CSV Loader)                               | #52        |
| #46   | dmerced05 | 2w ago  | enhancement                 | Light and dark mode button                                                                        | #51        |
| #47   | dmerced05 | 4d ago  | —                           | Console tab and error handling with csv loader                                                    | likely #56 |
| #49   | dmerced05 | 4d ago  | —                           | JSON settings file for those hosting on local or server                                           | likely #56 |
| #54   | makayo    | 2w ago  | enhancement                 | Manual axis/column selection for datasets with 3+ numeric columns                                 | #55        |

**Note on #40:** this issue's resolution — auto-loading the bundled `mixed-sign-sample.csv` dataset for demo purposes — is the decision that #57 (open, current cycle) proposes to reverse. Worth reading #40 directly before starting #57's work, since it may explain constraints or reasoning not otherwise documented.

**"Likely" links** above are inferred from title/timing correlation, not explicit issue↔PR cross-references — GitHub's own "linked_closing_reference" markers were only visible for #7, #8, #9, #43, #52, and #54 in the pasted data. Treat the "likely" entries as reasonable inference, not confirmed fact, until checked directly against the repository.

---

## Part 3 — Pending / Open Work (current cycle, #57–#64)

### #57 — Remove bundled/default dataset (open, not started)

**Author:** makayo. Proposes reversing #40's decision — app currently auto-loads a bundled sample dataset on startup; intended to start blank instead.

### #58 — Address PR #56 review findings (split ownership, in progress)

- **makayo (complete):** type-safety fix to the severity-to-text color map; strengthened `isAppError` type guard; moved `nextLogId` into store state
- **dmerced05 (in progress, handed off):** changing `config.json`'s loading mechanism from a static build-time import to a runtime fetch, confirmed as the intended design

### #59 — QA pass: input robustness (held locally, pending team confirmation)

**Author:** makayo. 3 commits on `fix/59-input-robustness-qa`, not yet pushed. Full QA pass, two real bug fixes (inverted numeric range, colors.csv typo validation), new `ParseInterpretation` observability contract, 8-character truncation spec, first automated test suite (70 tests), `TESTING_GUIDE.md`. One open design question pending team confirmation before finalizing.

### #64 — Application-wide test coverage strategy (open, newly filed)

**Author:** makayo. Scopes long-term testing into Tier 1 (pure logic), Tier 2 (state/component/integration), Tier 3 (3D/visual).

---

## Current state summary

**Shipped:** #10–#52, #55–#56, #61, #63 (27 merged PRs), covering the full foundation through deployment config/diagnostics, the 2D dataset alignment fix, and the 2D camera lock, plus the #58 portion completed by makayo. #53 closed without merging.

**Open PRs awaiting review:** none currently — #61 and #63 both merged.

**In progress:** #58 remainder (dmerced05), #59 held locally pending team confirmation (makayo)

**Open, not started:** #57, #64

---

## Notes on this document's accuracy

PR and issue titles, authorship, close/merge status, dates, and labels are verified directly against the repository's closed PR and closed issue lists as retrieved. Issue↔PR pairings are explicit only where GitHub's own linked-closing-reference data was present in the source; all other pairings are marked "likely" and inferred from title and timing correlation.

**4 of 29 closed issues are not yet reconciled** against this document — the pasted closed-issues data accounted for 25 (issues #5 through #54). The remaining 4 are unidentified and likely fall in the lowest-numbered range (#1–#4) or were missed in the retrieval; confirm directly against the repository if a complete record is needed.

Entries for the current work cycle (#57 onward) additionally reflect direct source inspection, manual testing, and the automated test suite built during that work.
