# Particles Slider Double-Click Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add double-click reset-to-50 behavior to the six requested Particles and viewport ratio sliders.

**Architecture:** Reuse the current slider `input` pipeline instead of adding new state mutation paths. Attach `dblclick` listeners only to the six target range inputs and dispatch a synthetic `input` event after restoring the default value.

**Tech Stack:** Vanilla JavaScript, DOM event listeners, Playwright smoke tests

---

### Task 1: Add failing UI coverage

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke test that:
- clears local storage before load
- changes the six target sliders to non-`50` values
- double-clicks each slider
- asserts the slider values and matching labels return to `50`
- double-clicks a non-target slider such as `bpmSlider` and asserts it does not reset

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "double-click resets the six Particles and viewport sliders to 50"`

Expected: FAIL because no `dblclick` reset behavior exists yet.

### Task 2: Implement the minimal UI binding

**Files:**
- Modify: `scripts/features/ui-events.js`

**Step 1: Add a small helper**

Create a local helper that accepts a range input and default value, then:
- binds `dblclick`
- sets `slider.value = "50"`
- dispatches `new Event("input", { bubbles: true })`

**Step 2: Bind only the requested sliders**

Wire the helper to:
- `dom.distSlider`
- `dom.scatterSlider`
- `dom.delaySlider`
- `dom.glowRangeSlider`
- `dom.playlineRatioSlider`
- `dom.stickyLockRatioSlider`

Do not bind other range inputs.

### Task 3: Verify the behavior

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `scripts/features/ui-events.js`

**Step 1: Run the targeted smoke test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "double-click resets the six Particles and viewport sliders to 50"`

Expected: PASS

**Step 2: Run a static check**

Run: `npm run typecheck`

Expected: PASS
