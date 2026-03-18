# Late-Opening Staff Envelopes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve later-opening staff groups in the SVG staff model so `蕾拉弦乐.svg` reports the missing post-measure-13 barlines and measures.

**Architecture:** Replace the single dominant horizontal-line envelope in `scripts/features/svg-analysis.js` with per-envelope clustering and validation. Keep `scripts/app.js` consuming the same exported caches, so the barline fix comes from a more complete upstream staff model rather than barline-specific heuristics.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests, SVG DOM analysis

---

### Task 1: Add the failing late-opening staff regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a Playwright smoke test for `蕾拉弦乐.svg` that waits for analysis completion, then captures:
- `barlineCount`
- `measureCount`
- `window.globalAbsoluteStaffLineYs`

Assert that:
- `barlineCount > 13`
- `measureCount > 12`
- At least one exported staff line has `minX` significantly larger than the opening staff envelope, proving a later-opening staff group survived.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "late-opening staff groups in Laila strings"`
Expected: FAIL because the current cache drops the later-opening staff group, leaving `barlineCount` at `13` and `measureCount` at `12`.

**Step 3: Commit**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: cover late-opening staff envelopes"
```

### Task 2: Implement multi-envelope staff validation

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Refactor the horizontal bridge-line pipeline to:
- cluster merged bridge rows by similar `minX/maxX`
- validate each cluster independently with the existing five-line gap logic
- union validated bridge rows into `globalAbsoluteBridgeLineYs`
- union validated five-line rows into `globalAbsoluteStaffLineYs`

Prefer small helpers for:
- clustering candidate envelopes
- validating a cluster into five-line staff rows

**Step 2: Run the targeted test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "late-opening staff groups in Laila strings"`
Expected: PASS

**Step 3: Run adjacent bridge/barline regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "fragmented multi-group barlines in Dengshan|Water Town|late-opening staff groups in Laila strings"`
Expected: PASS for the new regression and the nearby bridge/barline smoke coverage.

**Step 4: Commit**

```bash
git add scripts/features/svg-analysis.js tests/score-scroll-smoke.spec.js
git commit -m "fix: keep validated late-opening staff envelopes"
```

### Task 3: Verify no downstream regression in barline consumers

**Files:**
- Modify: none unless verification exposes a gap
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the broader smoke subset**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dengshan|time signatures|opening barline|late-opening staff groups in Laila strings"`
Expected: PASS

**Step 2: Inspect the final behavior**

Confirm the final `蕾拉弦乐.svg` state shows:
- more than one highlighted barline beyond the opening
- `measureCount > 12`
- a later-opening staff envelope in `window.globalAbsoluteStaffLineYs`

**Step 3: Commit**

```bash
git add docs/plans/2026-03-18-late-opening-staff-envelopes-design.md docs/plans/2026-03-18-late-opening-staff-envelopes.md scripts/features/svg-analysis.js tests/score-scroll-smoke.spec.js
git commit -m "docs: record late-opening staff envelope plan"
```
