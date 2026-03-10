# Auto Fit Zoom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically fit imported SVG scores to the viewport height after import, export-ratio changes, and browser window resizing, while keeping the zoom slider synchronized.

**Architecture:** Add a focused auto-fit helper to `scripts/app.js` and route the three approved triggers through it. Keep the manual zoom slider behavior intact, but let auto-fit reclaim control on import, ratio changes, and resize. Preserve export behavior by skipping auto-fit during export mode.

**Tech Stack:** Vanilla ES modules, DOM geometry, Playwright smoke tests.

---

### Task 1: Add failing regressions for auto-fit zoom behavior

**Files:**
- Create: `tests/fixtures/auto-fit-zoom.svg`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add a minimal tall SVG fixture and a Playwright regression that:

- imports the fixture and asserts the zoom UI changes from its initial value
- changes export ratio and asserts the zoom UI changes again
- resizes the browser viewport and asserts the zoom UI changes again

Also add a structural assertion that the app source contains a dedicated auto-fit helper and routes ratio-change / resize behavior through it.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "automatically fits score height"`

Expected: FAIL because the current app does not recompute zoom automatically.

### Task 2: Implement score-height auto-fit

**Files:**
- Modify: `scripts/app.js`

**Step 1: Preserve the computed score height**

Remove the overwrite that replaces the content-aware `globalScoreHeight` with `svgRect.height`.

**Step 2: Add the auto-fit helper**

Create a helper that:

- validates preview-mode preconditions
- computes `viewportHeight / globalScoreHeight`
- clamps and applies the result
- updates the zoom UI
- resizes and redraws the canvas

**Step 3: Wire the approved triggers**

Call the helper:

- after SVG import geometry is ready
- from `handleExportRatioChange`
- from the window resize path

Skip auto-fit during export mode.

**Step 4: Run the targeted regression**

Run the same grep command.

Expected: PASS.

### Task 3: Verify the baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` only if the regression needs cleanup

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.
