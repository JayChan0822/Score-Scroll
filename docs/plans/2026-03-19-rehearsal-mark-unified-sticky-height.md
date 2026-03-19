# Rehearsal Mark Unified Sticky Height Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align pinned rehearsal marks in each sticky lane to one shared vertical height above the opening clef.

**Architecture:** Keep the existing sticky lock timing and lane grouping. Extend sticky Y handling so each lane computes a rehearsal-mark target bottom edge from the opening clef, then offset the active rehearsal block to that shared height while pinned.

**Tech Stack:** Vanilla JS, Playwright, SVG analysis, sticky layout helpers.

---

### Task 1: Add the failing sticky-layout regression

**Files:**
- Modify: `tests/sticky-layout.spec.js`
- Test: `tests/sticky-layout.spec.js`

**Step 1: Write the failing test**

Add a regression covering three cases for one helper:
- high rehearsal mark returns a positive Y offset,
- aligned rehearsal mark returns `0`,
- low colliding rehearsal mark returns a negative Y offset.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "rehearsal marks align to a shared sticky height above the opening clef"`
Expected: FAIL because the current helper only supports upward collision relief.

### Task 2: Implement the unified-height helper

**Files:**
- Modify: `scripts/features/sticky-layout.mjs`
- Test: `tests/sticky-layout.spec.js`

**Step 1: Replace the helper semantics**

Implement a helper that:
- returns `0` without an opening clef anchor,
- computes `targetBottomY = clefMinY - padding`,
- returns `targetBottomY - rehearsalMaxY`.

**Step 2: Run the focused test**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "rehearsal marks align to a shared sticky height above the opening clef"`
Expected: PASS

### Task 3: Wire the helper into sticky rendering

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/features/svg-analysis.js`

**Step 1: Preserve sticky block Y bounds**

Ensure render-queue items keep absolute Y bounds and sticky blocks store `minY` / `maxY`.

**Step 2: Compute the active lane rehearsal offset**

In `renderCanvas()`, compute the active rehearsal block for each lane and use the new helper to derive one `rehY` offset against the opening clef block.

**Step 3: Apply the Y offset only to pinned rehearsal marks**

Keep all existing X-offset and opacity logic intact.

### Task 4: Verify regressions

**Files:**
- Test: `tests/sticky-layout.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the sticky-layout suite**

Run: `npx playwright test tests/sticky-layout.spec.js`
Expected: PASS

**Step 2: Run the rehearsal smoke coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "threads rehearsal marks into sticky lane replacement order|keeps tightly enclosed Dorico rehearsal-mark frames attached to their letters"`
Expected: PASS

**Step 3: Run type checking**

Run: `npx tsc -p tsconfig.json`
Expected: PASS
