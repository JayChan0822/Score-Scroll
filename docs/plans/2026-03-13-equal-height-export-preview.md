# Equal-Height Export Preview Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the desktop preview viewport the same height as the left control column while letting preview width adapt to export ratio changes.

**Architecture:** The desktop layout keeps a fixed shared column height, with the preview viewport filling that height. A shared preview-frame sizing function computes the ratio-accurate preview width from the fixed height and selected export settings, and the app applies that width while leaving the outer layout height unchanged. Export encoding continues to use the shared export-dimension logic.

**Tech Stack:** Vanilla JavaScript, CSS grid/flex layout, Playwright smoke tests.

---

### Task 1: Add failing desktop equal-height and width-adaptation tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add runtime tests that:
- load a minimal SVG into the app on a desktop viewport
- assert the preview column height matches the control column height after ratio changes
- assert the preview width changes when switching between at least two export ratios while height remains fixed

**Step 2: Run tests to verify red**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps the desktop preview height aligned with the control column across export ratio changes|adapts the desktop preview width when export ratio changes"`
Expected: FAIL because the preview still uses the current height-sync behavior and fixed-width desktop layout.

### Task 2: Update desktop layout to keep columns equal height

**Files:**
- Modify: `styles/layout.css`
- Modify: `styles/stage.css`

**Step 1: Implement the minimal layout change**

Adjust the desktop grid/flex rules so the left control stack defines the shared column height and the right stage column stretches to match it. Ensure mobile layout remains unchanged.

**Step 2: Re-run the focused tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps the desktop preview height aligned with the control column across export ratio changes"`
Expected: Still red or partially green until the width sync logic is added.

### Task 3: Replace desktop preview height syncing with width syncing

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/features/export-video.js`
- Modify: `scripts/features/ui-events.js`

**Step 1: Implement shared preview-frame sizing**

Add a helper that derives the ratio-accurate preview width from the fixed preview height and selected export ratio. Reuse shared export-dimension data where it helps preserve fidelity with real exports.

**Step 2: Wire desktop preview updates**

Update the app so desktop preview ratio changes adjust viewport width and centering instead of changing viewport height. Keep current mobile behavior intact.

**Step 3: Run focused tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps the desktop preview height aligned with the control column across export ratio changes|adapts the desktop preview width when export ratio changes|wires export resolution and ratio changes into preview-height syncing"`
Expected: PASS after renaming or updating the static wiring assertion to match the new width-sync behavior.

### Task 4: Refresh cache version and run export regressions

**Files:**
- Modify: `index.html`
- Modify: `scripts/app.js` if module query strings change

**Step 1: Bump the app/module cache version**

Update the module version string so the browser reloads the new layout and preview logic.

**Step 2: Run regression coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "exports numbered png frames through the directory access api|prefers local file streaming targets for mp4 export when file system access is available|falls back to in-memory mp4 export when local file streaming is unavailable|keeps the desktop preview height aligned with the control column across export ratio changes|adapts the desktop preview width when export ratio changes"`
Expected: PASS
