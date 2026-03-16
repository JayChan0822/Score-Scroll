# Non-Power-of-Two Time Signatures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore recognition and timeline parsing for valid stacked numeric meters such as `5/6`, `9/10`, and `15/16`.

**Architecture:** Keep the current candidate collection, stacked-pair geometry checks, and anchor validation. Replace the denominator power-of-two whitelist inside stacked-pair validation with a generic positive-integer rule, and use bounding-box centers for stacked-pair alignment so multi-digit text tokens pair reliably. Lock the behavior with a targeted Playwright smoke regression using a dedicated minimal SVG fixture.

**Tech Stack:** Vanilla ES modules, SVG DOM analysis, Playwright smoke tests.

---

### Task 1: Add the failing regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Use fixture: `tests/fixtures/water-town-opening-instruments.svg`

**Step 1: Write the failing test**

Add a regression that loads a dedicated fixture, waits for analysis, then asserts:

- highlighted time-signature tokens include stacked `5/6`
- highlighted time-signature tokens include stacked `9/10`
- highlighted time-signature tokens include stacked `15/16`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes non-power-of-two stacked numeric time signatures in Dorico imports"`

Expected: FAIL because the current stacked-pair validator rejects denominators not listed in the whitelist and does not robustly align multi-digit text stacks.

### Task 2: Implement the minimal legality fix

**Files:**
- Modify: `scripts/app.js`

**Step 1: Replace the denominator whitelist dependency**

Update the stacked-pair legality helper so both numerator and denominator are validated as positive integers instead of checking denominator membership in a hardcoded set.

**Step 2: Use center-point alignment for stacked text pairing**

Update the stacked-pair reference point helper to compare candidate bounding-box centers so multi-digit text meters like `9/10` and `15/16` can align with their partners.

**Step 3: Preserve existing geometry and anchor behavior**

Do not change:

- stacked-partner matching
- staff-band filtering
- anchor proximity checks
- tablature-specific gating

**Step 4: Run the regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes non-power-of-two stacked numeric time signatures in Dorico imports"`

Expected: PASS.

### Task 3: Verify affected baseline behavior

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` only if assertion cleanup is needed

**Step 1: Run focused time-signature coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes non-power-of-two stacked numeric time signatures in Dorico imports|keeps Finale Ash opening time signatures decoded into the timeline|recognizes opening tablature time signatures before fingering digits|recognizes percussion time signatures for non-five-line staves"`

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Remove any temporary diagnostics**

Delete any debug-only code or temporary assertions added during investigation before finishing.
