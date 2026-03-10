# SVG Analysis Module Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract SVG preprocessing and render-queue analysis from `scripts/app.js` into a dedicated feature module while preserving behavior.

**Architecture:** Add `scripts/features/svg-analysis.js` with a single feature entry point that owns SVG color preprocessing and render-queue construction. Keep `scripts/app.js` as the orchestrator that invokes the feature and writes returned analysis results back into existing state and legacy window globals.

**Tech Stack:** Vanilla ES modules, Playwright smoke tests, JSDoc `@ts-check`.

---

### Task 1: Add a failing regression for the SVG analysis module

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke assertion that expects `scripts/features/svg-analysis.js` to exist and `scripts/app.js` to create/use the SVG analysis feature.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "extracts svg preprocessing and render-queue analysis into a dedicated feature module"`

Expected: FAIL because the module does not exist yet.

**Step 3: Write minimal implementation**

Create the SVG analysis module and wire it into `app.js`.

**Step 4: Run test to verify it passes**

Run the same grep command.

Expected: PASS.

### Task 2: Extract the SVG analysis pipeline

**Files:**
- Create: `scripts/features/svg-analysis.js`
- Modify: `scripts/app.js`

**Step 1: Move parser-local helpers into the new module**

Extract `preprocessSvgColors`, `buildRenderQueue`, `buildTimeSignatureStaffBandsFromLineYs`, and their local helper functions into the feature module.

**Step 2: Return structured analysis results**

Return `renderQueue`, `stickyMinX`, `globalStickyLanes`, `globalAbsoluteStaffLineYs`, and `globalAbsoluteSystemInternalX` from the module instead of mutating top-level app state directly.

**Step 3: Rewire app orchestration**

Instantiate the feature in `app.js`, call it after SVG import, and write the returned values back into app state and legacy window globals.

### Task 3: Verify extracted structure and behavior

**Files:**
- Modify: `tsconfig.json`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Include the new feature in typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the targeted extraction regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "extracts svg preprocessing and render-queue analysis into a dedicated feature module"`

Expected: PASS.

**Step 3: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.
