# Project Orinoco — Developer Contribution & Accountability Record

**Sentient Solutions — Flow Visualizer, Phase 1**

This document records each developer's contributions to Project Orinoco, sourced directly from the repository's pull request and issue history. It is maintained as a factual accountability reference for the project team and stakeholders.

- **Prepared by:** Mark Yosinao & Daniel Merced
- **Repository:** [cwheelus/orinoco](https://github.com/cwheelus/orinoco)
- **Source:** GitHub pull request and issue history (`gh` CLI, cwheelus/orinoco)
- **Total Merged Pull Requests Recorded:** 33
- **Total Open Issues Recorded:** 1

> **Note:** Some features reflect iterative, collaborative work across multiple pull requests and both developers — for example, the signed grid and octant-isolation system was built collaboratively across several PRs (#37, #42, #63). Attribution below reflects the developer who authored and merged each specific pull request, not sole ownership of the underlying feature area.

Refer to the linked pull request or issue number on GitHub for exact dates, full diffs, and discussion history.

---

## Section 1 — Mark Yosinao

**Key Features Delivered**

- Built the CSV data-loading pipeline, with auto-detection of numeric/text columns and specific error handling for malformed files
- Designed and implemented the signed, symmetric 3D Cartesian grid with per-axis scaling modes and octant isolation
- Added the analyst-facing toolbar: manual axis mapping, per-axis tick controls, dark/light mode toggle, and the colors.csv classification override system
- Built the 2D (Z-less) camera mode — locked top-down view, remapped controls, and automatic camera snapping
- Wrote and maintained USER_GUIDE.md and README.md throughout the project, keeping documentation in sync with the application's actual behavior
- Authored Tier 1 pure-logic test coverage for gridSpace.ts and classColors.ts (PR #68)

_24 merged pull requests, plus 1 closed (unmerged), spanning core visualization features, data loading, camera/navigation systems, testing infrastructure, and project documentation._

| PR #                                               | Feature / Work Contributed                                                                                                                                                          | Category              | Status |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------ |
| [#72](https://github.com/cwheelus/orinoco/pull/72) | Docs follow-up for #70 — added USER_GUIDE.md §4.6 (2D Mode) and §7.7 (colors.csv), corrected tilt-guardrails claim, standardized icon table wording                                 | Documentation         | Merged |
| [#70](https://github.com/cwheelus/orinoco/pull/70) | Docs: consolidated README usage details into USER_GUIDE.md; corrected stale references (bundled dataset, test counts, tilt guardrails) and added colors.csv / 2D Mode documentation | Documentation         | Merged |
| [#68](https://github.com/cwheelus/orinoco/pull/68) | Tier 1 pure-logic test coverage: gridSpace.ts, classColors.ts (37 tests)                                                                                                            | Testing / Enhancement | Merged |
| [#67](https://github.com/cwheelus/orinoco/pull/67) | Added opacity to point material, addressing overlap/density finding                                                                                                                 | Bug Fix / Enhancement | Merged |
| [#65](https://github.com/cwheelus/orinoco/pull/65) | QA pass (#59): input robustness, colors.csv validation, and classification observability                                                                                            | Bug Fix / Enhancement | Merged |
| [#63](https://github.com/cwheelus/orinoco/pull/63) | Locked camera to X/Y plane in 2D mode; disabled orbit/tilt controls (#62)                                                                                                           | Bug Fix / Enhancement | Merged |
| [#61](https://github.com/cwheelus/orinoco/pull/61) | Hid 3D bounding box in 2D dataset mode; verified alignment (#60)                                                                                                                    | Bug Fix               | Merged |
| [#55](https://github.com/cwheelus/orinoco/pull/55) | Manual axis/column selection for datasets with 3+ numeric columns                                                                                                                   | Enhancement           | Merged |
| [#53](https://github.com/cwheelus/orinoco/pull/53) | Cleaned up Copilot review comments from #52                                                                                                                                         | Documentation         | Closed |
| [#52](https://github.com/cwheelus/orinoco/pull/52) | Added unlimited classes, colors.csv override, flexible numeric columns, 2D flat-plane rendering, and HUD metadata (closes #43)                                                      | Enhancement           | Merged |
| [#51](https://github.com/cwheelus/orinoco/pull/51) | Added manual light/dark mode toggle                                                                                                                                                 | Enhancement           | Merged |
| [#45](https://github.com/cwheelus/orinoco/pull/45) | Rewrote README for signed grid, octant isolation, and CSV-only loading                                                                                                              | Documentation         | Merged |
| [#44](https://github.com/cwheelus/orinoco/pull/44) | Rewrote USER_GUIDE.md for signed grid, octant isolation, and CSV-only loading                                                                                                       | Documentation         | Merged |
| [#41](https://github.com/cwheelus/orinoco/pull/41) | Added USER_GUIDE.md — analyst-facing documentation                                                                                                                                  | Documentation         | Merged |
| [#37](https://github.com/cwheelus/orinoco/pull/37) | Desmos-style 3D grid mode: centered Y axis + zero-plane mode                                                                                                                        | Enhancement           | Merged |
| [#36](https://github.com/cwheelus/orinoco/pull/36) | Added per-axis tick label visibility toggle                                                                                                                                         | Enhancement           | Merged |
| [#34](https://github.com/cwheelus/orinoco/pull/34) | Added pan tool for click-and-drag view translation                                                                                                                                  | Enhancement           | Merged |
| [#31](https://github.com/cwheelus/orinoco/pull/31) | Updated README to reflect CSV loader, Toolbar, and grid toggle work                                                                                                                 | Documentation         | Merged |
| [#30](https://github.com/cwheelus/orinoco/pull/30) | Fixed HUD to show axis labels next to metric values in Point Analysis panel                                                                                                         | Bug Fix               | Merged |
| [#29](https://github.com/cwheelus/orinoco/pull/29) | Implemented CSV loading system                                                                                                                                                      | Enhancement           | Merged |
| [#18](https://github.com/cwheelus/orinoco/pull/18) | Added reset-to-origin button for the camera pivot                                                                                                                                   | Enhancement           | Merged |
| [#17](https://github.com/cwheelus/orinoco/pull/17) | Updated axis labels to match actual CSV columns                                                                                                                                     | Bug Fix               | Merged |
| [#14](https://github.com/cwheelus/orinoco/pull/14) | Implemented open-face Cartesian grid with corrected axes                                                                                                                            | Enhancement           | Merged |
| [#13](https://github.com/cwheelus/orinoco/pull/13) | Added explanatory comments to core components                                                                                                                                       | Documentation         | Merged |
| [#12](https://github.com/cwheelus/orinoco/pull/12) | Added team workflow documentation                                                                                                                                                   | Documentation         | Merged |

---

## Section 2 — Daniel Merced

**Key Features Delivered**

- Built the camera navigation system — orbit, dolly, and pivot traversal, with data-anchored axis labels
- Implemented instanced point-cloud rendering with count-adaptive sizing and data filtering, for datasets scaling to 100k+ points
- Designed the deployment config.json system and the session diagnostics Console, with standardized, versioned error codes
- Contributed to the signed grid and octant-isolation rework, plus the app's navigation guardrails
- Fixed the initial startup flow so the application ships with no bundled dataset, addressing prior PR review findings
- Exported config.ts's validate() and extracted isVisible() for Tier 1 test coverage; added the analyst-controlled point-opacity slider (PR #71)

_9 merged pull requests, spanning camera and rendering systems, deployment configuration, diagnostics, and Tier 1 test coverage._

| PR #                                               | Feature / Work Contributed                                                                                                      | Category                                     | Status |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------ |
| [#71](https://github.com/cwheelus/orinoco/pull/71) | Exported config.ts validate(); extracted isVisible() from PointCloud render loop; added analyst-controlled point-opacity slider | Testing / Enhancement                        | Merged |
| [#66](https://github.com/cwheelus/orinoco/pull/66) | Started the application blank (#57); addressed PR #56 review findings (#58)                                                     | Bug Fix / Documentation / Refactor / Testing | Merged |
| [#56](https://github.com/cwheelus/orinoco/pull/56) | Deployment config.json and diagnostics console with standardized error codes                                                    | Enhancement                                  | Merged |
| [#42](https://github.com/cwheelus/orinoco/pull/42) | Desmos-style signed grid revised, octant isolation, CSV-only data loading, and navigation guardrails                            | Bug Fix / Enhancement                        | Merged |
| [#32](https://github.com/cwheelus/orinoco/pull/32) | Instanced point rendering, count-adaptive sizing, and data filters                                                              | Enhancement                                  | Merged |
| [#23](https://github.com/cwheelus/orinoco/pull/23) | Fixed the pivot cross marker tracking                                                                                           | Bug Fix                                      | Merged |
| [#20](https://github.com/cwheelus/orinoco/pull/20) | Camera navigation redesign with data-anchored axis labels                                                                       | Enhancement                                  | Merged |
| [#15](https://github.com/cwheelus/orinoco/pull/15) | Centered the grid and scaling, plus minor tweaks                                                                                | Enhancement                                  | Merged |
| [#10](https://github.com/cwheelus/orinoco/pull/10) | Updated README; added project demo video                                                                                        | Documentation                                | Merged |

---

## Section 3 — Outstanding Work (Open Issues)

_3 open issues remain in the repository at time of writing, representing planned or under-consideration work not yet completed._

| Issue #                                              | Title                                                                                              | Opened By     | Label       | Assigned Next                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------- | ----------- | ------------------------------- |
| [#64](https://github.com/cwheelus/orinoco/issues/64) | Establish complete application test coverage, with TESTING_GUIDE.md as the living testing strategy | Mark Yosinao  | enhancement | Daniel Merced (Tier 2 & Tier 3) |
| [#50](https://github.com/cwheelus/orinoco/issues/50) | Code cleaning and review                                                                           | Daniel Merced | —           | —                               |
| [#48](https://github.com/cwheelus/orinoco/issues/48) | (Optional) Filter/setting rules block code style revamp if #43 makes the UI too cluttered          | Daniel Merced | —           | —                               |

_#64's Tier 1 scope is complete (see Section 1 and Section 2 above). Tier 2 (application/state behavior) and Tier 3 (3D/browser/visual behavior) were confirmed via team discussion as Daniel Merced's next assignment._

---

_Note: Category and label fields reflect the repository's own PR/issue labels at time of writing. Refer to the linked pull request or issue number on GitHub for exact dates, full diffs, and discussion history._
