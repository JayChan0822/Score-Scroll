# Bracket And Barline Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple bracket-line recognition from barline recognition so left-of-system bracket lines are highlighted even when they are separate verticals from the first system barline.

**Architecture:** Keep the change inside `scripts/app.js` and adjust only `identifyAndHighlightGeometricBrackets()`. Add a small regression SVG fixture and a Playwright smoke assertion that proves the first true barline stays the barline while all verticals immediately to its left become bracket lines.

**Tech Stack:** Vanilla ES modules, browser DOM geometry, Playwright smoke tests.

---

### Task 1: Add a failing regression for independent bracket lines

**Files:**
- Create: `tests/fixtures/bracket-barline-separation.svg`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Create a minimal SVG fixture with:

- a tall first barline
- two vertical bracket lines directly to its left
- short horizontal caps connected to the bracket lines

Add a Playwright regression that uploads the fixture and asserts:

- the tall rightmost line is `highlight-barline`
- the left-of-barline verticals are `highlight-brace`
- those left-of-barline verticals are not required to be `highlight-barline`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "classifies left-of-system verticals as bracket lines without relying on barline classes"`

Expected: FAIL because the current bracket scanner only considers `highlight-barline` verticals.

### Task 2: Separate bracket candidate discovery from barline classes

**Files:**
- Modify: `scripts/app.js`

**Step 1: Re-derive the first structural barline in the left search area**

Inside `identifyAndHighlightGeometricBrackets()`, identify the first true barline geometrically from left-edge vertical segments rather than filtering by `highlight-barline`.

**Step 2: Collect bracket verticals independently**

Select vertical lines in a narrow band immediately left of the locked barline and mark them as bracket candidates.

**Step 3: Preserve current horizontal-cap support**

Keep the existing connected-horizontal logic so cap segments are still highlighted where present.

**Step 4: Run the targeted regression**

Run the same grep command.

Expected: PASS.

### Task 3: Verify the baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` only if the regression needs final cleanup

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.

**Step 3: Remove any temporary debug-only test files**

Delete one-off inspection specs that were only used during investigation.
