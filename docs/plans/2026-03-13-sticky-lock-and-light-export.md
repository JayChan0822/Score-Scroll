# Sticky Lock Control And Light Export Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an independent sticky-lock position slider and ensure Light-theme MP4 exports preserve the active background color.

**Architecture:** Split horizontal positioning into two controls: `playlineRatio` for the scanline and `stickyLockRatio` for sticky pinning. Reuse the existing render pipeline, but compute a separate sticky anchor X for sticky drawing, mask placement, and bridge redraws. For export, explicitly fill the offscreen canvas with the current theme background before drawing non-transparent video frames.

**Tech Stack:** Vanilla JavaScript modules, DOM controls, Canvas 2D rendering, WebCodecs/MP4 muxer mocks, Playwright smoke tests.

---

### Task 1: Add failing tests for sticky-lock control and Light export background

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write failing sticky-lock tests**

Add tests that verify:
- the new `吸顶位置` slider is present and wired through DOM/app source
- sticky lock uses a separate state path from `playlineRatio`

**Step 2: Write failing Light export test**

Add a mocked MP4 export test in Light mode that captures the first export frame pixel and expects a light background color instead of black.

**Step 3: Run tests to verify red**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds an independent sticky lock slider beneath the scanline control|uses separate horizontal ratios for the scanline and sticky lock position|fills Light-theme MP4 export frames with the active background color"`
Expected: FAIL

### Task 2: Add sticky-lock UI, DOM refs, and state

**Files:**
- Modify: `index.html`
- Modify: `scripts/core/dom.js`
- Modify: `scripts/core/state.js`
- Modify: `scripts/features/ui-events.js`
- Modify: `scripts/app.js`

**Step 1: Add the new slider UI**

Add `stickyLockRatioSlider` and `stickyLockRatioVal` below the scanline slider.

**Step 2: Thread the new state through the app**

Add `stickyLockRatio` to initial state, bind the new slider input event, update the displayed percentage, and redraw when it changes.

**Step 3: Re-run focused sticky-lock tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds an independent sticky lock slider beneath the scanline control|uses separate horizontal ratios for the scanline and sticky lock position"`
Expected: PASS

### Task 3: Use sticky lock ratio in the render pipeline

**Files:**
- Modify: `scripts/app.js`

**Step 1: Implement separate sticky anchor math**

Compute a `stickyScreenX` from `stickyLockRatio` and use it for sticky pinning, sticky masking, bridge redraw anchoring, and sticky draw translation. Leave the scanline and normal score draw path on `playlineRatio`.

**Step 2: Re-run sticky-lock tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "uses separate horizontal ratios for the scanline and sticky lock position"`
Expected: PASS

### Task 4: Fix Light-theme MP4 export background

**Files:**
- Modify: `scripts/app.js`
- Reference: `scripts/features/export-video.js`

**Step 1: Fill the export frame background**

In `renderCanvas`, when `transparentBackground` is false, fill the entire canvas with the active background color before drawing any score elements. Keep transparent behavior for PNG export.

**Step 2: Run focused export test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "fills Light-theme MP4 export frames with the active background color"`
Expected: PASS

### Task 5: Bump cache version and run regressions

**Files:**
- Modify: `index.html`
- Modify: `scripts/app.js` if module query versions change

**Step 1: Refresh cache version**

Update the app/module version so browsers pick up the new control and export behavior.

**Step 2: Run regression coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds a png sequence export entry point|prefers local file streaming targets for mp4 export when file system access is available|falls back to in-memory mp4 export when local file streaming is unavailable|keeps the desktop preview height aligned with the control column across export ratio changes|adapts the desktop preview width when export ratio changes|adds an independent sticky lock slider beneath the scanline control|uses separate horizontal ratios for the scanline and sticky lock position|fills Light-theme MP4 export frames with the active background color"`
Expected: PASS
