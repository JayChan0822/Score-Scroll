# Initial Barline Coordinate Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix opening-system detection by unifying the initial barline heuristic onto one coordinate space so transformed-text clefs no longer break opening barlines, instrument names, or opening key signatures.

**Architecture:** Keep the repair localized to `scripts/app.js`. Rewrite `identifyAndHighlightInitialBarlines()` so opening-cluster decisions use screen-space geometry consistently while still retaining SVG-internal X values for downstream consumers. Add one Playwright regression that imports the real failing SVG and locks the corrected behavior.

**Tech Stack:** Vanilla ES modules, browser DOM geometry, Playwright smoke tests, TypeScript JSDoc checking.

---

### Task 1: Add a failing regression for the Opus opening-anchor scenario

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a regression that uploads `/Users/jaychan/Desktop/Green Tea Farm - Full score - 01 Flow 1.svg` and asserts:

- there is at least one `.highlight-barline`
- the `Piano` text has `.highlight-instname`
- the first `` text has `.highlight-keysig`
- the first `` text does not have `.highlight-accidental`

**Step 2: Run the regression to verify it fails**

Run: `npx playwright test --grep "preserves opening barlines, instrument names, and key signatures for transformed Opus SVG imports"`

Expected: FAIL because the current code produces zero opening barlines, leaves `Piano` unclassified, and downgrades the opening flat to an accidental.

**Step 3: Leave the failing regression in place**

Do not touch production code until the failure proves the bug is captured.

### Task 2: Unify the opening-barline heuristic onto screen-space geometry

**Files:**
- Modify: `scripts/app.js`

**Step 1: Extract minimal geometry helpers**

Add a small helper near `identifyAndHighlightInitialBarlines()` that can return screen-space left/right positions for candidate lines and clefs without repeating `getBoundingClientRect()` handling inline.

**Step 2: Rework opening vertical collection**

Keep the existing internal X extraction from SVG attributes, but also store the matching screen-space left position for each vertical line candidate.

**Step 3: Rework clef anchor extraction**

Replace the current `getBBox()` / `getCTM()` comparison path with a screen-space clef anchor derived from `getBoundingClientRect()`.

**Step 4: Make the cluster decision in one space**

Use only screen-space values when deciding whether the leftmost vertical cluster is at or before the first clef. Continue storing the selected internal X into `globalSystemInternalX` and the selected screen X into `globalSystemBarlineScreenX`.

**Step 5: Run the targeted regression**

Run: `npx playwright test --grep "preserves opening barlines, instrument names, and key signatures for transformed Opus SVG imports"`

Expected: PASS.

### Task 3: Verify the repaired behavior against the existing baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` only if the new test needs final naming or small cleanup

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the full smoke suite**

Run: `npx playwright test`

Expected: PASS.

**Step 3: Check for stray debugging artifacts**

Remove any temporary diagnostic code or one-off files that were only needed during investigation.
