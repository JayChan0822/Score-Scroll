# Water Town Segmented Bridge Lines Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve segmented Water Town staff rows in the sticky bridge-line cache so pinned flute/oboe rows redraw their five staff lines inside the mask.

**Architecture:** Keep the current bridge-line pipeline, but merge same-row horizontal segments into a single candidate before dominant-envelope filtering and five-line validation. This confines the fix to `svg-analysis.js` and leaves sticky item classification and mask drawing untouched.

**Tech Stack:** Vanilla JS, Playwright smoke tests, SVG geometry analysis.

---

### Task 1: Add the failing segmented-bridge regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a Water Town regression that loads `tests/fixtures/water-town-opening-instruments.svg`, builds the render queue through `createSvgAnalysisFeature()`, finds the `Flute` and `Oboe` instrument rows, and asserts the affected opening rows have five nearby bridge lines instead of zero.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preserves segmented Water Town bridge lines for opening flute and oboe rows"`

Expected: FAIL because the current bridge-line cache drops the segmented rows.

### Task 2: Implement minimal bridge-line segment merging

**Files:**
- Modify: `scripts/features/svg-analysis.js`

**Step 1: Write minimal implementation**

Introduce a helper that groups near-equal-`y` horizontal segments and merges adjacent segments when their horizontal gap is within a conservative tolerance. Feed the merged rows into the existing dominant-envelope and five-line validation logic.

**Step 2: Run the focused regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preserves segmented Water Town bridge lines for opening flute and oboe rows"`

Expected: PASS.

### Task 3: Re-verify existing bridge redraw coverage

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the Water Town and Dengshan bridge tests together**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preserves segmented Water Town bridge lines for opening flute and oboe rows|keeps Dengshan piano bridge redraw limited to true full-span staff lines"`

Expected: PASS.

**Step 2: Confirm workspace cleanliness for this change**

Ensure no temporary debug files remain and that only the intended files were edited.
