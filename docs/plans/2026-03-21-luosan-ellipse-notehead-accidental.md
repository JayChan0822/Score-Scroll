# Luosan Ellipse Notehead Accidental Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reclassify flats near ellipse/circle noteheads as accidentals instead of leaving them as key signatures.

**Architecture:** Extend only the accidental notehead collection stage in `scripts/app.js`. Add geometric notehead support for `ellipse/circle`, use a notehead-specific relaxed band resolver, and keep the rest of the accidental graph logic unchanged.

**Tech Stack:** Vanilla JavaScript, SVG DOM inspection, Playwright smoke tests

---

### Task 1: Add a failing regression test

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Add a minimal SVG builder**

Create a helper that returns an SVG buffer containing:
- one staff
- a mid-system barline
- a flat accidental candidate
- a nearby hollow notehead drawn as `ellipse`
- the ellipse placed slightly away from the five-line staff

**Step 2: Add a smoke test**

Load the SVG and assert the target flat ends as:
- `highlight-accidental`
- not `highlight-keysig`

**Step 3: Run the test and confirm RED**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "reclassifies flats near ellipse noteheads that sit slightly away from the staff"`

Expected:
- FAIL because ellipse noteheads are not currently collected for accidental reclassification.

### Task 2: Extend accidental notehead collection

**Files:**
- Modify: `scripts/app.js`

**Step 1: Add a notehead-specific band resolver**

Implement a helper that:
- tries the existing `resolveStaffBandIndex()`
- falls back to a relaxed nearest/overlap match for noteheads near a staff band
- returns `-1` only when no plausible staff band is nearby

**Step 2: Add geometric notehead collection**

In `identifyAndHighlightAccidentals()`:
- scan `ellipse` and `circle`
- keep only notehead-like shapes with small, roughly round geometry
- push them into the same `noteheads` array used for accidental classification

**Step 3: Preserve borderline noteheads**

Pass collected noteheads into `classifyAccidentalGroups()` without filtering out `bandIndex === -1`, so the symbol graph can use its fallback Y-proximity logic when needed.

### Task 3: Verify

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the targeted regression**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "reclassifies flats near ellipse noteheads that sit slightly away from the staff"`

Expected:
- PASS

**Step 2: Run nearby accidental regressions**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "reclassifies mid-system flats adjacent to hollow noteheads|reclassifies Water Town mid-system flats"`

Expected:
- PASS

**Step 3: Run static verification**

Run:
`npm run typecheck`

Expected:
- PASS
