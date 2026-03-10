# Two Column Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the page into a two-column workspace with the preview on the left, `Sources` on the top-right, and `Particle & Transport` on the bottom-right, while preserving a stacked mobile layout.

**Architecture:** Make a small DOM regrouping in `index.html` and drive the layout from CSS in `styles/layout.css`, with only minimal stage sizing adjustments if needed. Preserve all ids and behavior so JavaScript remains untouched.

**Tech Stack:** Static HTML, CSS Grid/Flexbox, Playwright smoke tests.

---

### Task 1: Add failing regressions for the new workspace layout

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add regressions that assert:

- `index.html` contains `workspace-layout` and `control-stack`
- on desktop viewport width, the preview is left of the `Sources` card and the `Particle & Transport` card
- on desktop viewport width, `Sources` is above `Particle & Transport`
- on mobile viewport width, the preview, `Sources`, and `Particle & Transport` stack vertically in that order

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "uses a left preview with a right stacked control column"`

Expected: FAIL because the current page is not structured that way.

### Task 2: Reorganize the main workspace DOM

**Files:**
- Modify: `index.html`

**Step 1: Add the new wrappers**

Wrap the stage and the two control cards in:

- `workspace-layout`
- `control-stack`

**Step 2: Add semantic card classes**

Add explicit card classes such as:

- `sources-card`
- `transport-card`

Keep all control ids unchanged.

**Step 3: Run the targeted test**

Run the same grep command.

Expected: still FAIL on layout relation assertions, but pass the new structure assertions.

### Task 3: Implement the two-column responsive layout

**Files:**
- Modify: `styles/layout.css`
- Modify: `styles/stage.css` if needed

**Step 1: Add the desktop workspace grid**

Make `workspace-layout` a two-column grid with the preview on the left and `control-stack` on the right.

**Step 2: Add the right-column stack**

Make `control-stack` a vertical layout for the two cards.

**Step 3: Add the responsive collapse**

At smaller breakpoints, collapse the workspace back to a single column in the approved order.

**Step 4: Run the targeted regression**

Run the same grep command.

Expected: PASS.

### Task 4: Verify the baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` only if the assertions need cleanup

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.
