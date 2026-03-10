# Time Signature Detection Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the linked SVG import bugs where the opening stacked time signature is missed, a left-edge stem is treated as an opening barline, and an isolated Sebastian `2` is treated as a valid time signature.

**Architecture:** Keep the current scanner structure in `scripts/app.js` and repair the faulty heuristics in place. Add a focused Playwright regression that injects a minimal SVG fixture reproducing the bad geometry so the fix is test-first and does not depend on a user-specific local file path.

**Tech Stack:** Vanilla ES modules, browser DOM geometry, Playwright smoke tests.

---

### Task 1: Add a failing regression for the linked SVG detection bugs

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a targeted regression that loads a minimal SVG fixture through the existing upload flow and asserts:

- the opening stacked `` glyphs are highlighted as time signatures
- the short left-edge stem is not highlighted as a barline
- the later isolated `` glyph is not highlighted as a time signature

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps stacked opening time signatures while rejecting short stems and isolated sebastian digits"`

Expected: FAIL with the current heuristics.

**Step 3: Keep the failing regression in place**

Do not change production code until the failure proves the test is exercising the bug.

### Task 2: Repair opening-barline selection

**Files:**
- Modify: `scripts/app.js`

**Step 1: Implement the minimal cluster filter**

In `identifyAndHighlightInitialBarlines()`, filter the left-edge start cluster so short outlier stems are dropped when materially taller verticals exist in the same cluster.

**Step 2: Run the targeted regression**

Run the same grep command.

Expected: FAIL, but now for time-signature assertions rather than the barline assertion.

### Task 3: Repair stacked time-signature validation

**Files:**
- Modify: `scripts/app.js`

**Step 1: Extract partner detection helper**

Add a small helper that tests whether a candidate has a vertically stacked partner with near-aligned X and bounded Y separation.

**Step 2: Apply it to both ASCII digits and Sebastian time-signature glyphs**

Require pairing for standard sized numeric/glyph time signatures while preserving the existing giant Sibelius path.

**Step 3: Restore near-barline rejection**

If a candidate is neither near a physical barline nor near the fallback system start, reject it before applying `highlight-timesig`.

**Step 4: Run the targeted regression**

Run the same grep command.

Expected: PASS.

### Task 4: Verify the full baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` if the regression needs cleanup or final naming polish

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.

**Step 3: Remove temporary debug artifacts if no longer needed**

Delete any one-off debug test files created during investigation that are not part of the permanent regression suite.
