# Preview Focus Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current browser fullscreen preview toggle with an in-page focus mode that hides the page header and left control panels so the preview viewport fills the page content area.

**Architecture:** Reuse the existing preview pill button as a layout toggle. Instead of calling the Fullscreen API, `scripts/app.js` will toggle a `preview-focus-mode` class on `body`, resync the button icon and labels, and trigger the existing preview sizing/canvas resize flow so the enlarged viewport redraws correctly. CSS in `styles/layout.css` and `styles/stage.css` will hide non-preview UI and promote the preview column to the only visible content region.

**Tech Stack:** Vanilla HTML/CSS, DOM state toggling, Canvas resize/render pipeline, Playwright smoke tests.

---

### Task 1: Add failing focus-mode tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Replace the old browser-fullscreen expectation**

Update the existing preview-toggle smoke test so it no longer expects `document.fullscreenElement` to become `#viewport`. Instead, assert that the page enters a preview focus mode while `document.fullscreenElement` stays `null`.

**Step 2: Add a layout-focused smoke test**

Add assertions that clicking the pill button hides `header` and `.control-stack`, keeps `#viewport` visible, and increases the preview area compared with the default layout. Then click again and assert the default layout returns.

**Step 3: Run the focused tests to verify red**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill|toggles preview focus mode from the zoom pill"`
Expected: FAIL because the app still uses browser fullscreen semantics.

### Task 2: Update the pill button presentation

**Files:**
- Modify: `index.html`
- Modify: `styles/stage.css`

**Step 1: Replace the text glyph with a corner icon**

Change the pill button content from the current text glyph to a standard four-corner icon representation suitable for two states: enter focus and exit focus.

**Step 2: Add minimal icon styling**

Add only the CSS needed to size and align the corner icon within the existing `zoom-btn` treatment. Keep the button visually consistent with the `+` and `−` controls.

**Step 3: Re-run the focused rendering test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill"`
Expected: PASS

### Task 3: Replace browser fullscreen logic with focus-mode state

**Files:**
- Modify: `scripts/app.js`
- Reference: `scripts/core/dom.js`

**Step 1: Remove Fullscreen API behavior**

Delete the `requestFullscreen()` / `exitFullscreen()` code path and any helper logic that treats the button as browser fullscreen.

**Step 2: Add focus-mode state helpers**

Implement helpers that:
- detect whether `body` has `preview-focus-mode`
- add/remove that class
- update the button icon, `title`, `aria-label`, and `aria-pressed`

**Step 3: Resync preview sizing after toggles**

After each toggle, rerun the existing viewport sizing and canvas resize/redraw flow so the preview fills its new container immediately.

**Step 4: Re-run the focused toggle test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "toggles preview focus mode from the zoom pill"`
Expected: PASS

### Task 4: Add preview-focus layout rules

**Files:**
- Modify: `styles/layout.css`
- Modify: `styles/stage.css`

**Step 1: Hide non-preview sections in focus mode**

Add focus-mode selectors that hide `header` and `.control-stack`.

**Step 2: Promote the preview column to full-width**

Change `.workspace-layout`, `.stage-wrap`, and `#viewport` in focus mode so the preview occupies the full page content region and near-full viewport height.

**Step 3: Preserve preview controls**

Ensure the zoom pill remains visible and correctly positioned in focus mode.

**Step 4: Re-run the focused layout tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill|toggles preview focus mode from the zoom pill"`
Expected: PASS

### Task 5: Refresh module versions and run regressions

**Files:**
- Modify: `index.html`
- Modify: `scripts/app.js` if module query versions change

**Step 1: Bump the app module version**

Update `APP_MODULE_VERSION` in `index.html` so browsers load the new preview-focus behavior instead of the previous browser-fullscreen behavior.

**Step 2: Bump import query versions if needed**

If imported modules remain version-pinned from `scripts/app.js`, update only the relevant `?v=` suffixes that need cache refresh.

**Step 3: Run regression coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "positions the zoom slider at the top-left of the viewport|renders a viewport fullscreen button inside the zoom pill|toggles preview focus mode from the zoom pill"`
Expected: PASS

### Task 6: Commit the feature correction

**Files:**
- Modify: `index.html`
- Modify: `styles/layout.css`
- Modify: `styles/stage.css`
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Review the final diff**

Confirm the change removes browser fullscreen semantics and replaces them with an in-page preview focus mode only.

**Step 2: Commit**

```bash
git add index.html styles/layout.css styles/stage.css scripts/app.js tests/score-scroll-smoke.spec.js
git commit -m "feat: replace preview fullscreen with focus mode"
```
