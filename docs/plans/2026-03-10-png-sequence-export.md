# PNG Sequence Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `Export PNG` button that exports a transparent-background PNG sequence into an auto-created subfolder while reusing the existing export settings and progress UI.

**Architecture:** Extend the current export feature instead of building a second exporter. Keep shared export setup, validation, canvas switching, frame iteration, modal progress, and cancel handling in one place, then branch only at the output stage for MP4 muxing versus PNG file writing through the File System Access API.

**Tech Stack:** Vanilla ES modules, browser File System Access API, canvas `toBlob`, Playwright smoke tests, JSDoc `@ts-check`.

---

### Task 1: Add failing regressions for the PNG export surface

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add smoke assertions that require:

- `index.html` to contain an `Export PNG` button next to the export controls
- `scripts/core/dom.js` to expose `exportPngBtn`
- `scripts/features/ui-events.js` to bind the PNG export click path

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds a png sequence export entry point"`

Expected: FAIL because the button and wiring do not exist yet.

**Step 3: Write minimal implementation**

Add the new button, DOM reference, and event binding without implementing the full export body yet.

**Step 4: Run test to verify it passes**

Run the same grep command.

Expected: PASS.

### Task 2: Add the PNG export UI and event wiring

**Files:**
- Modify: `index.html`
- Modify: `scripts/core/dom.js`
- Modify: `scripts/features/ui-events.js`
- Modify: `styles/controls.css` if button layout needs adjustment

**Step 1: Add the new button**

Insert `exportPngBtn` immediately after `exportVideoBtn` in the existing export button group.

**Step 2: Expose the DOM reference**

Extend the `DomRefs` typedef and `getDomRefs()` return object with `exportPngBtn`.

**Step 3: Bind the click handler**

Wire the new button to a dedicated PNG export callback from the export feature.

**Step 4: Run the targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds a png sequence export entry point"`

Expected: PASS.

### Task 3: Add a failing regression for PNG export capability handling

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a regression that requires `scripts/features/export-video.js` to expose a PNG export entry point and include a guard for `showDirectoryPicker`.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "guards png sequence export behind directory access support"`

Expected: FAIL because the PNG export path does not exist yet.

**Step 3: Write minimal implementation**

Add the PNG export entry point and the capability check stub.

**Step 4: Run test to verify it passes**

Run the same grep command.

Expected: PASS.

### Task 4: Refactor shared export preparation and cleanup

**Files:**
- Modify: `scripts/features/export-video.js`

**Step 1: Extract shared export parsing**

Create a small helper for:

- reading `exportStartInput` and `exportEndInput`
- validating `startSec`, `endSec`, and total duration
- returning normalized export settings

**Step 2: Extract shared canvas switching**

Create a helper that:

- creates the offscreen export canvas
- swaps canvas, context, viewport width, and zoom into export mode
- returns a cleanup callback that restores original state

**Step 3: Extract shared modal lifecycle**

Create helpers for:

- opening the export modal
- updating progress text and bar
- setting cancel button state
- closing the modal during success, failure, or cancellation

**Step 4: Re-run the existing export smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.

### Task 5: Implement transparent PNG sequence export

**Files:**
- Modify: `scripts/features/export-video.js`

**Step 1: Add PNG export entry point**

Implement `exportPngSequence(...)` in the export feature and expose it from the module.

**Step 2: Add directory selection and folder creation**

Use `window.showDirectoryPicker()` to pick the destination directory, then create a timestamped child directory such as `score-scroll-png-YYYYMMDD-HHMMSS`.

**Step 3: Reuse the shared frame loop**

For each frame:

- compute the export timestamp from FPS and export range
- update the smooth playback state the same way MP4 export does
- render the frame through the existing `renderCanvas`
- encode the frame to PNG with `canvas.toBlob("image/png")`
- write the PNG into the created folder using `createWritable()`

**Step 4: Make the background transparent only for PNG export**

Add a narrow export-mode flag or render option that clears the export canvas with transparency while leaving normal rendering and MP4 export unchanged.

**Step 5: Support cancellation and cleanup**

Stop frame generation when cancel is requested, keep already-written files, and always restore the original render state.

### Task 6: Verify PNG export structure and baseline safety

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Add structural regression coverage**

Assert that:

- the PNG export method is exposed from the export feature
- the File System Access capability guard exists
- the timestamped folder naming path exists
- PNG writing uses `image/png`

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Run the targeted PNG export regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "png sequence export|directory access support"`

Expected: PASS.

**Step 4: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add index.html styles/controls.css scripts/core/dom.js scripts/features/ui-events.js scripts/features/export-video.js tests/score-scroll-smoke.spec.js docs/plans/2026-03-10-png-sequence-export-design.md docs/plans/2026-03-10-png-sequence-export.md
git commit -m "feat: add png sequence export"
```
