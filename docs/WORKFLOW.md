# Project Orinoco // Team Workflow

This document defines how we branch, commit, review, and merge work in `cwheelus/orinoco`. It's a living document — update it as the team agrees on changes.

---

## 1. Repo Structure

- **`cwheelus/orinoco`** — the authoritative project repo (owned by the project sponsor). All work lives here.

## 2. Branching Model

```
main
  │
  ├── feature/<short-topic>     (one branch per issue/feature)
  ├── feature/<short-topic>
  └── feature/<short-topic>
```

- **`main`** — stable, always deployable/demoable. All feature branches are created from `main` and merged back into it via pull request.
- **`feature/<short-topic>`** — one branch per issue or feature, branched off `main`. Name branches after what they accomplish, not implementation details.

**Branch prefixes:**

- `feature/` — new functionality or code changes.
- `docs/` — documentation-only changes (READMEs, workflow docs, etc.).
- `chore/` — housekeeping, tooling, or config changes not tied to a specific feature.

**Before starting a new branch:** confirm your working tree is clean (`git status`) and pull the latest `main` (`git pull origin main`) so you don't drag uncommitted changes or stale history into the new branch.

## 3. Claiming Work

- All planned work should have a **card on the Projects board** before someone starts it, to avoid duplicate effort.
- Claim a card by assigning yourself before you branch.
- If you start work that isn't yet on the board, add a card for it as soon as you realize it needs tracking.

## 4. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short summary>

<optional body>
```

- **Types:** `feat` (new feature), `fix` (bug fix), `docs` (documentation only), `refactor` (code change with no behavior change), `chore` (tooling/config), `test` (tests only).
- **Scope** is optional — the component or area affected (e.g. `axes`, `grid`, `camera`).
- Example: `feat(grid): add toggle to show/hide cartesian gridlines`
- Add a body with bullet points when a commit touches multiple files or bundles related sub-changes.
- Keep unrelated changes (e.g. docs-only updates) as separate commits from code changes, even on the same branch.

## 5. Pull Requests & Review

- Open a pull request from your feature branch when the work is ready for review.
- The other contributor reviews the change before it is merged.
- No branch protection rules or enforced approval gate for now — review happens directly between the two contributors.
- PR descriptions should note what changed, why, and anything the reviewer should specifically check.
- Small, self-contained PRs are preferred over large, multi-feature ones — easier to review, easier to revert if needed.
- Project advisors review demos and provide direction on technical specifications; they are not part of code-level review.

## 6. Syncing Between Contributors

- Run `git fetch` / `git pull` before starting new work each session to avoid working from a stale base.
- If two people are working on related components that need to agree on shared assumptions (naming, scale, data shape, etc.), sync directly before diverging too far — don't rely on the PR review to catch structural mismatches after the fact.
