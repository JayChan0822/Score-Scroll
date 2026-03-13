# Full-Viewport Preview Focus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current low-impact preview focus mode with a full-viewport in-page preview card that visibly fills the browser window while keeping the rounded preview frame.

**Architecture:** Keep the existing `preview-focus-mode` state and pill button, but stop treating focus mode as a mild layout expansion. Instead, make `.stage-wrap` enter a fixed-position, viewport-filling state with a small inset, hide all non-preview page content, and let `#viewport` consume the fixed container. Reuse the existing resize/redraw path so the canvas remeasures after the container jumps to viewport scale.

**Tech Stack:** Vanilla HTML/CSS, DOM class toggling, existing canvas resize pipeline, Playwright smoke tests.

---

### Task 1: Add failing viewport-fill assertions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Tighten the focus-mode test**

Extend the current `toggles preview focus mode from the zoom pill` test so it asserts:
- `.stage-wrap` becomes `position: fixed`
- the focused preview width and height are close to the browser viewport dimensions minus a small inset
- the viewport frame keeps a non-zero border radius

**Step 2: Verify the new assertions fail**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "toggles preview focus mode from the zoom pill"`
Expected: FAIL because the current implementation only expands within the page layout instead of occupying a fixed viewport-filling container.

### Task 2: Promote the preview container to a fixed viewport layer

**Files:**
- Modify: `styles/layout.css`
- Modify: `styles/stage.css`

**Step 1: Replace the current focus-mode layout rules**

Remove the existing focus-mode rules that only single-column the normal layout.

**Step 2: Add fixed-position focus-mode rules**

Make `.stage-wrap` use a fixed-position viewport-filling layout with a small inset while focus mode is active. Ensure `#viewport` fills the full fixed container height and width.

**Step 3: Hide remaining non-preview chrome**

Hide `header`, `.control-stack`, and any decorative overlays that visually compete with the focus card.

**Step 4: Re-run the focused layout test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "toggles preview focus mode from the zoom pill"`
Expected: PASS

### Task 3: Keep focus-mode logic aligned with the new layout

**Files:**
- Modify: `scripts/app.js`

**Step 1: Verify resize flow against the fixed container**

Ensure the existing focus-mode toggle still triggers enough resize/reflow passes for the new fixed layout to render at full size on entry and exit.

**Step 2: Add only minimal logic if needed**

If the current double-resize pass is insufficient, add the smallest targeted adjustment necessary to stabilize the new viewport-sized layout.

**Step 3: Re-run the focused tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "renders a viewport fullscreen button inside the zoom pill|toggles preview focus mode from the zoom pill"`
Expected: PASS

### Task 4: Refresh module versions and run regressions

**Files:**
- Modify: `index.html`
- Modify: `scripts/app.js` if import query versions change

**Step 1: Bump the app module version**

Update `APP_MODULE_VERSION` so browsers load the new full-viewport focus-mode behavior.

**Step 2: Refresh related module version pins if needed**

Update only the import query strings that need cache invalidation for this change.

**Step 3: Run focused regression coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "positions the zoom slider at the top-left of the viewport|renders a viewport fullscreen button inside the zoom pill|toggles preview focus mode from the zoom pill"`
Expected: PASS

### Task 5: Commit the focus-mode correction

**Files:**
- Modify: `styles/layout.css`
- Modify: `styles/stage.css`
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `index.html` if version strings change

**Step 1: Review the final diff**

Confirm the change is limited to making focus mode truly viewport-filling while preserving the rounded preview frame.

**Step 2: Commit**

```bash
git add styles/layout.css styles/stage.css scripts/app.js tests/score-scroll-smoke.spec.js index.html
git commit -m "feat: make preview focus mode fill the viewport"
```
