# Custom Export Ratio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users choose a custom export aspect ratio from the ratio list, enter it in a modal, and have preview sizing, exports, and saved settings all honor that custom ratio.

**Architecture:** Keep the existing ratio select as the single UI entry point, but add a `custom` sentinel option plus a stored `customExportRatio` string. Introduce a small ratio-resolution layer in `scripts/app.js` and `scripts/features/export-video.js` so all preview/export sizing consumes the resolved effective ratio rather than the raw select value.

**Tech Stack:** Vanilla JavaScript, HTML/CSS modal UI, localStorage persistence, Playwright smoke tests.

---

### Task 1: Lock the custom-ratio UI and behavior in tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing structure regression**

Add a source-level test that asserts:
- `index.html` contains a `custom` export ratio option,
- `index.html` contains the custom ratio modal/input/buttons,
- `scripts/core/dom.js` exposes the custom ratio DOM refs.

**Step 2: Run the structure regression to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds a custom export ratio entry and modal controls"`
Expected: FAIL because the custom option and modal do not exist yet.

**Step 3: Write the failing runtime regression**

Add a browser test that:
- loads `index.html`,
- imports a minimal SVG,
- switches the ratio select to `custom`,
- fills the modal with `3:2`,
- confirms the dialog,
- asserts the select label becomes `自定义 (3:2)`,
- asserts the preview height stays fixed while the width reflects the custom ratio.

**Step 4: Run the runtime regression to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "applies a confirmed custom export ratio to the preview and select label"`
Expected: FAIL because there is no custom-ratio modal flow yet.

### Task 2: Add the custom-ratio UI shell

**Files:**
- Modify: `index.html`
- Modify: `styles/modal.css`
- Modify: `scripts/core/dom.js`
- Modify: `scripts/features/ui-events.js`

**Step 1: Add the custom option and modal markup**

Extend the export ratio select with a final `value="custom"` option and add a modal containing:
- a ratio text input,
- inline validation text,
- confirm and cancel buttons.

**Step 2: Expose the new DOM refs**

Add typed DOM references for the custom-ratio modal elements in `scripts/core/dom.js`.

**Step 3: Bind the new modal events**

Wire confirm, cancel, input, and keyboard handlers through `scripts/features/ui-events.js` so `scripts/app.js` can own the behavior.

**Step 4: Run the structure regression to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds a custom export ratio entry and modal controls"`
Expected: PASS.

### Task 3: Implement custom-ratio state, validation, and preview wiring

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write the minimal custom-ratio state helpers**

Add helpers that:
- track the last non-custom ratio,
- store the normalized custom ratio string,
- resolve the effective export ratio for preview/export consumers,
- update the custom option label.

**Step 2: Implement the modal behavior**

Add handlers to:
- open the modal when `custom` is selected,
- validate and normalize `w:h` input,
- confirm or cancel cleanly,
- support Enter to confirm and Escape to cancel.

**Step 3: Route preview sizing through the resolved ratio**

Update viewport sizing and desktop/mobile preview calculations to use the effective ratio helper instead of parsing the raw select value directly.

**Step 4: Persist and restore custom ratio state**

Save the select choice, custom ratio string, and last usable preset in local storage, then restore them on load while keeping the custom label synchronized.

**Step 5: Run the runtime regression to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "applies a confirmed custom export ratio to the preview and select label"`
Expected: PASS.

### Task 4: Route exports through the resolved custom ratio

**Files:**
- Modify: `scripts/features/export-video.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Add a shared ratio-normalization/resolution helper**

Expose or add a small helper that safely resolves the effective aspect ratio string before `computeSharedExportDimensions()` parses it.

**Step 2: Use the resolved ratio in MP4 and PNG export flows**

Ensure both export entry points pass the effective custom ratio string, not the raw `custom` sentinel, into export dimension calculation.

**Step 3: Add a source-level export regression**

Assert the export feature source no longer assumes `dom.exportRatioSelect?.value` is directly parseable as `w:h`.

**Step 4: Run the targeted custom-ratio suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "custom export ratio"`
Expected: PASS.

### Task 5: Final focused verification

**Files:**
- Modify: `index.html`
- Modify: `styles/modal.css`
- Modify: `scripts/core/dom.js`
- Modify: `scripts/features/ui-events.js`
- Modify: `scripts/features/export-video.js`
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Re-run the custom-ratio tests together**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds a custom export ratio entry and modal controls|applies a confirmed custom export ratio to the preview and select label"`
Expected: PASS.

**Step 2: Re-run adjacent preview/export ratio regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps the desktop preview height aligned with the control column across export ratio changes|adapts the desktop preview width when export ratio changes|wires export resolution and ratio changes into desktop preview-frame syncing"`
Expected: PASS.

**Step 3: Review the final diff for state and modal spillover**

Confirm the implementation is limited to export-ratio UI, persistence, preview sizing, and export dimension handling.
