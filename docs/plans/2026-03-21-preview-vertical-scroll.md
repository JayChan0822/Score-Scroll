# Preview Vertical Scroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a preview-local vertical scrollbar and wheel scrolling when the zoomed score is taller than the preview viewport.

**Architecture:** Keep `#viewport` as the visible preview frame and introduce an inner scroll host that owns vertical overflow. Resize canvas against the visible preview width but the full rendered content height, then feed the scroll offset back into rendering so the preview can pan vertically without affecting page scroll.

**Tech Stack:** Vanilla JS, HTML/CSS, Playwright smoke tests, canvas rendering.

---

### Task 1: Add failing preview overflow regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add smoke coverage for:
- a tall score at higher zoom exposing `scrollHeight > clientHeight` inside the preview scroll host
- wheel input over the preview changing that host's `scrollTop`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: FAIL because the preview currently has no dedicated vertical scroll host.

**Step 3: Write minimal implementation**

Do not implement yet in this task.

**Step 4: Run test to verify it still fails correctly**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: FAIL with assertions showing no overflow or no scroll movement.

**Step 5: Commit**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: add preview vertical scroll regressions"
```

### Task 2: Add the preview scroll host structure

**Files:**
- Modify: `index.html`
- Modify: `styles/stage.css`
- Modify: `scripts/core/dom.js`

**Step 1: Write the failing test**

Reuse the Task 1 tests.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: FAIL before DOM/CSS changes are applied.

**Step 3: Write minimal implementation**

- Wrap `#score-canvas` in a new preview scroll element inside `#viewport`
- Keep zoom controls positioned above the viewport
- Update DOM refs so app code can read the new scroll host
- Style the scroll host with `overflow-y: auto`, `overflow-x: hidden`, and full-frame sizing

**Step 4: Run test to verify progress**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: Still FAIL or partially pass until canvas sizing/render integration is added.

**Step 5: Commit**

```bash
git add index.html styles/stage.css scripts/core/dom.js
git commit -m "feat: add preview scroll host structure"
```

### Task 3: Wire canvas sizing and vertical scroll behavior

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/core/dom.js`

**Step 1: Write the failing test**

Reuse the same Task 1 smoke tests.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: FAIL because scroll host still does not reflect full rendered score height or wheel scrolling.

**Step 3: Write minimal implementation**

- Add helpers to compute rendered content height from `globalScoreHeight * globalZoom`
- Resize canvas height to the larger of visible viewport height and rendered content height
- Read preview scroll offset during render and translate drawing vertically by that offset
- Attach a wheel handler on the preview scroll host so wheel input moves the preview scroll position
- Preserve existing desktop/mobile/focus sizing logic for the outer viewport

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/app.js scripts/core/dom.js tests/score-scroll-smoke.spec.js
git commit -m "feat: add vertical scrolling to preview"
```

### Task 4: Verify preview sizing regressions

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run targeted existing preview tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "desktop preview width|desktop auto preview width stable"`
Expected: PASS

**Step 2: Run the new vertical scroll tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: PASS

**Step 3: Run a focused final verification batch**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "desktop preview width|desktop auto preview width stable|preview becomes vertically scrollable|preview wheel scrolls vertically"`
Expected: PASS

**Step 4: Confirm no unexpected behavior remains**

Check that the preview still resizes correctly on desktop and in focus mode, and that page scroll outside the preview remains normal.

**Step 5: Commit**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: verify preview scroll behavior"
```
