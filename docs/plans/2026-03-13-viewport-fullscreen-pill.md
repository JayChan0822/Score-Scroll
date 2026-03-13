# Viewport Fullscreen Pill Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fullscreen toggle inside the existing preview zoom pill so the right-side preview viewport can enter and exit web fullscreen without affecting the left control panel.

**Architecture:** Extend the current zoom pill markup with a new fullscreen button, expose it through the shared DOM reference helper, and keep fullscreen logic local to `scripts/app.js`. Use the browser Fullscreen API against `#viewport`, then listen to `fullscreenchange` so the button icon, title, and accessibility text stay synchronized when fullscreen is entered, exited, or canceled with `Esc`.

**Tech Stack:** Vanilla HTML/CSS, browser Fullscreen API, shared DOM refs, Playwright smoke tests.

---

### Task 1: Add failing fullscreen toolbar tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write a failing layout test**

Add a smoke test that loads `/index.html`, locates `#zoomInBtn`, `#viewportFullscreenBtn`, and `#zoomValDisplay`, and asserts the fullscreen button is visible inside `.zoom-control-wrapper` and horizontally positioned between the `+` button and the zoom percentage.

**Step 2: Write a failing fullscreen behavior test**

Add a smoke test that clicks `#viewportFullscreenBtn`, waits for `document.fullscreenElement?.id` to become `"viewport"`, clicks the button again, and waits for `document.fullscreenElement` to become `null`.

**Step 3: Run the focused tests to verify red**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill|toggles viewport web fullscreen from the zoom pill"`
Expected: FAIL because the fullscreen button and toggle logic do not exist yet.

### Task 2: Add the fullscreen button to the zoom pill

**Files:**
- Modify: `index.html`
- Modify: `styles/stage.css`

**Step 1: Add the button markup**

Insert a `button` with `id="viewportFullscreenBtn"` between `#zoomInBtn` and `#zoomValDisplay` inside `.zoom-control-wrapper`. Give it the same `zoom-btn` class as the existing zoom buttons plus an initial `aria-label` and `title` for entering fullscreen.

**Step 2: Add the minimal styling**

Reuse the existing pill layout and button styling. Only add the minimum extra CSS needed for a fullscreen icon state if the default button rules are not enough.

**Step 3: Re-run the focused layout test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill"`
Expected: PASS

### Task 3: Expose the button through shared DOM refs

**Files:**
- Modify: `scripts/core/dom.js`

**Step 1: Extend the DOM typedef**

Add `viewportFullscreenBtn` to the `DomRefs` typedef with the correct button type.

**Step 2: Return the new DOM ref**

Add `viewportFullscreenBtn: byId(doc, "viewportFullscreenBtn")` to `getDomRefs()`.

**Step 3: Keep the public shape aligned**

Make sure the returned object order stays readable near the existing zoom controls so `scripts/app.js` can destructure the new ref cleanly.

### Task 4: Implement fullscreen toggle logic in the app

**Files:**
- Modify: `scripts/app.js`

**Step 1: Wire the new DOM ref**

Destructure `viewportFullscreenBtn` from `getDomRefs(document)` and include it in the shared `dom` object if needed by other helpers.

**Step 2: Add fullscreen state helpers**

Implement small helpers that:
- detect whether `document.fullscreenElement === viewportEl`
- request fullscreen on `viewportEl`
- exit fullscreen through `document.exitFullscreen()`
- synchronize the button icon, `title`, `aria-label`, and disabled state

**Step 3: Bind the toggle behavior**

Register a click handler on `viewportFullscreenBtn` that toggles fullscreen for `#viewport`, catches rejected fullscreen promises, and always resynchronizes button state afterward.

**Step 4: Listen for external fullscreen exits**

Listen to `document` `fullscreenchange` so `Esc` exits and browser-driven fullscreen exits update the button state immediately.

**Step 5: Re-run the focused fullscreen tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill|toggles viewport web fullscreen from the zoom pill"`
Expected: PASS

### Task 5: Refresh module versions and run regressions

**Files:**
- Modify: `index.html`
- Modify: `scripts/app.js`

**Step 1: Bump the app module version**

Update `APP_MODULE_VERSION` in `index.html` so browsers load the new toolbar behavior.

**Step 2: Bump import query versions if needed**

If `scripts/core/dom.js` is still version-pinned from `scripts/app.js`, update the relevant `?v=` suffixes so the changed DOM helper is refreshed together with the app module.

**Step 3: Run fullscreen and existing toolbar regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "positions the zoom slider at the top-left of the viewport|renders a viewport fullscreen button inside the zoom pill|toggles viewport web fullscreen from the zoom pill"`
Expected: PASS

### Task 6: Commit the feature work

**Files:**
- Modify: `index.html`
- Modify: `styles/stage.css`
- Modify: `scripts/core/dom.js`
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Review the final diff**

Check that the change is limited to the preview toolbar, DOM wiring, fullscreen logic, and tests.

**Step 2: Commit**

```bash
git add index.html styles/stage.css scripts/core/dom.js scripts/app.js tests/score-scroll-smoke.spec.js
git commit -m "feat: add viewport fullscreen pill control"
```
