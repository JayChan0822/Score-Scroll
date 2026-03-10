# Workspace Scale Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Visually shrink the three-block workspace to roughly `75%` browser zoom while preserving desktop equal-height layout, auto-fit behavior, and mobile stacking.

**Architecture:** Wrap `workspace-layout` in a dedicated presentation container and scale that container visually instead of resizing each control individually. Keep layout sizing in the normal document flow, but apply a consistent desktop-only transform to the workspace so the preview and right column still compute correctly before being scaled.

**Tech Stack:** Vanilla HTML/CSS, ES modules, Playwright smoke tests.

---

### Task 1: Add failing regression for workspace-scale behavior

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Extend the existing desktop layout regression to assert:

- a dedicated workspace scale wrapper exists
- desktop `workspace-layout` has a computed transform consistent with `scale(0.75)`
- preview and right column still remain equal height after the desktop layout and ratio-change checks

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "uses a left preview with a right stacked control column"`

Expected: FAIL because there is no scale wrapper and no `0.75` workspace transform yet.

### Task 2: Implement workspace-scale wrapper and styles

**Files:**
- Modify: `index.html`
- Modify: `styles/base.css`
- Modify: `styles/layout.css`

**Step 1: Add the wrapper**

Wrap `workspace-layout` in a dedicated container so scaling is applied only to the work area, not the header.

**Step 2: Add the desktop scale**

Introduce a shared CSS variable for the workspace scale and apply it through a desktop-only transform anchored to the top-left corner.

**Step 3: Compensate for scaled footprint**

Ensure the wrapper reserves the correct visual space so the page does not collapse or leave inconsistent gaps after scaling.

**Step 4: Keep mobile behavior unchanged**

Disable the special scale treatment for the mobile stacked breakpoint.

**Step 5: Run the targeted regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "uses a left preview with a right stacked control column"`

Expected: PASS.

### Task 3: Verify the full baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` only if cleanup is needed

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run full smoke**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.
