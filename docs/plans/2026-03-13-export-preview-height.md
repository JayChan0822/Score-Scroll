# Export Preview Height Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the interactive preview viewport height match the actual exported video height whenever export settings change.

**Architecture:** Reuse the export dimension calculation in both the export feature and the main app. The app computes the current export target height from the selected resolution and aspect ratio, applies that height to the preview viewport, and redraws. The export pipeline itself remains unchanged except for exposing the shared dimension helper.

**Tech Stack:** Vanilla JavaScript modules, DOM/CSS sizing, Playwright smoke tests.

---

### Task 1: Add a failing preview-height sync test

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Reference: `scripts/features/export-video.js`

**Step 1: Write the failing test**

Add a Playwright test that loads `/index.html`, injects a minimal score state if needed, changes the export resolution and aspect ratio controls, then checks the viewport element height matches the target height derived from the same export dimension logic.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "syncs preview viewport height to the selected export video height"`
Expected: FAIL because preview height is still controlled by the existing viewport sizing logic instead of export dimensions.

**Step 3: Commit**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: add export preview height sync regression"
```

### Task 2: Share export dimension calculation with the app

**Files:**
- Modify: `scripts/features/export-video.js`
- Modify: `scripts/app.js`

**Step 1: Write minimal implementation**

Expose a reusable export-dimension helper from `scripts/features/export-video.js` or a small shared module. The helper must accept the current viewport width, score height, zoom, selected base resolution, and aspect ratio, and return `targetWidth`, `targetHeight`, and `finalExportZoom`.

**Step 2: Wire preview syncing in the app**

In `scripts/app.js`, add a function that:
- reads `exportResSelect` and `exportRatioSelect`
- computes export dimensions through the shared helper
- sets `viewportEl.style.height` to the computed `targetHeight`
- triggers `resizeCanvas()` and `renderCanvas(smoothX)` if the app is ready

Call this sync after score load, export ratio changes, export resolution changes, and resize handling.

**Step 3: Run the focused test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "syncs preview viewport height to the selected export video height"`
Expected: PASS

**Step 4: Commit**

```bash
git add scripts/features/export-video.js scripts/app.js tests/score-scroll-smoke.spec.js
git commit -m "feat: sync preview height with export video height"
```

### Task 3: Add static guardrails for event wiring

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Reference: `scripts/features/ui-events.js`
- Reference: `scripts/app.js`

**Step 1: Write the failing static assertion**

Add a test that checks the code responds to both export ratio and export resolution changes for preview sync behavior.

**Step 2: Run to verify red if needed**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "wires export resolution and ratio changes into preview-height syncing"`
Expected: FAIL before wiring, PASS after wiring.

**Step 3: Implement the minimal event hookup**

Ensure the app registers preview-height sync when either export control changes.

**Step 4: Run the static test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "wires export resolution and ratio changes into preview-height syncing"`
Expected: PASS

### Task 4: Run export regression coverage

**Files:**
- No code changes expected

**Step 1: Run related export tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "exports numbered png frames through the directory access api|prefers local file streaming targets for mp4 export when file system access is available|falls back to in-memory mp4 export when local file streaming is unavailable|syncs preview viewport height to the selected export video height|wires export resolution and ratio changes into preview-height syncing"`
Expected: PASS

**Step 2: Commit if any follow-up adjustments were needed**

```bash
git add tests/score-scroll-smoke.spec.js scripts/app.js scripts/features/export-video.js
git commit -m "test: verify export preview sizing regressions"
```
