# Rehearsal Mark Bottom-Lane Baseline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align bottom-lane sticky rehearsal marks to a unified low baseline below the opening symbols.

**Architecture:** Preserve the existing top-lane sticky baseline. Add lane metadata for system position and opening Y envelope, detect the bottom lane per system at render time, and switch bottom-lane rehearsal marks to a below-opening baseline.

**Tech Stack:** Vanilla JS, Playwright, SVG analysis, sticky layout helpers.

---

### Task 1: Add the failing helper regression

**Files:**
- Modify: `tests/sticky-layout.spec.js`

**Step 1: Write the failing test**

Add a regression proving bottom-lane rehearsal marks align to a unified low baseline below the opening symbols.

**Step 2: Run it and verify it fails**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "bottom-lane rehearsal marks align to a shared sticky height below the opening symbols"`
Expected: FAIL because the helper has no bottom-lane branch yet.

### Task 2: Implement bottom-lane baseline math

**Files:**
- Modify: `scripts/features/sticky-layout.mjs`
- Modify: `tests/sticky-layout.spec.js`

**Step 1: Extend the helper**

Teach the helper to support:
- above-opening bottom-edge alignment,
- below-opening top-edge alignment.

**Step 2: Re-run the focused helper test**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "bottom-lane rehearsal marks align to a shared sticky height below the opening symbols"`
Expected: PASS

### Task 3: Wire bottom-lane detection into rendering

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/app.js`

**Step 1: Preserve lane metadata**

Store enough lane metadata in `globalStickyLanes` to identify the bottom lane in each system and the opening vertical envelope.

**Step 2: Switch bottom lanes to the low baseline**

In `renderCanvas()`, choose the below-opening branch only for the bottom lane of the current system.

### Task 4: Verify regressions

**Files:**
- Test: `tests/sticky-layout.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run sticky-layout coverage**

Run: `npx playwright test tests/sticky-layout.spec.js`
Expected: PASS

**Step 2: Run rehearsal smoke coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "threads rehearsal marks into sticky lane replacement order|keeps tightly enclosed Dorico rehearsal-mark frames attached to their letters"`
Expected: PASS

**Step 3: Run type checking**

Run: `npx tsc -p tsconfig.json`
Expected: PASS
