# Boxed Rehearsal Marks Only Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make rehearsal-mark detection recognize only boxed one- or two-letter uppercase labels and reject all bare uppercase text.

**Architecture:** Keep the existing text and enclosure heuristics, but remove the staff-band and barline fallback path from the highlight pass so rehearsal marks are promoted only when a valid enclosure is found. Preserve the downstream render-queue and sticky-lane behavior that already expects framed rehearsal marks.

**Tech Stack:** Vanilla JavaScript, SVG DOM geometry, Playwright smoke tests

---

### Task 1: Add a boxed-only regression fixture and failing smoke test

**Files:**
- Create: `tests/fixtures/rehearsal-mark-boxed-only.svg`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke test that loads `tests/fixtures/rehearsal-mark-boxed-only.svg` and asserts:
- boxed `A`, `B`, `C`, `D`, `E` all receive `highlight-rehearsalmark`
- bare uppercase text in the same fixture does not receive `highlight-rehearsalmark`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects only boxed rehearsal marks regardless of vertical placement"`

Expected: FAIL because the current `targetBand` gate still filters out the higher boxed labels.

**Step 3: Write the minimal fixture**

Create a small SVG with:
- one staff built from horizontal `line` elements
- barlines for stable geometry
- five boxed uppercase labels, with some labels placed higher than the current `targetBand` window
- at least one bare uppercase label to confirm the new exclusion

**Step 4: Re-run the failing test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects only boxed rehearsal marks regardless of vertical placement"`

Expected: still FAIL, now against the committed regression fixture.

### Task 2: Convert rehearsal-mark detection to boxed-only promotion

**Files:**
- Modify: `scripts/app.js`

**Step 1: Update the detection logic**

Change `identifyAndHighlightRehearsalMarks()` so it:
- still filters text by `isRehearsalMarkText`
- finds the smallest valid enclosure using `isPotentialRehearsalEnclosure`
- promotes only texts with a matching enclosure
- no longer depends on `targetBand`, `nearBarline`, or `nearSystemStart`

**Step 2: Keep grouped frame highlighting**

Retain the existing `belongsToSameRehearsalEnclosureGroup()` pass so all shapes belonging to the chosen frame receive `highlight-rehearsalmark`.

**Step 3: Run the focused regression test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects only boxed rehearsal marks regardless of vertical placement"`

Expected: PASS.

### Task 3: Align expectations with boxed-only behavior

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `scripts/features/svg-analysis.js` (comments only if needed)

**Step 1: Update or replace stale rehearsal-mark expectations**

Adjust existing smoke coverage that assumes bare `A` / `AA` / `AB` / `AC` should be detected, so the suite matches the new boxed-only contract.

**Step 2: Clarify render-queue comments**

If needed, update nearby comments in `scripts/features/svg-analysis.js` so they describe boxed-only rehearsal-mark semantics.

**Step 3: Run the rehearsal-mark subset**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "rehearsal mark"`

Expected: PASS.

### Task 4: Verify no broader smoke regressions

**Files:**
- Modify: none

**Step 1: Run a broader smoke slice covering rehearsal and sticky behavior**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "rehearsal mark|sticky"`

Expected: PASS.

**Step 2: Inspect the git diff**

Run: `git diff -- scripts/app.js tests/score-scroll-smoke.spec.js tests/fixtures/rehearsal-mark-boxed-only.svg scripts/features/svg-analysis.js docs/plans/2026-03-17-boxed-rehearsal-marks-only-design.md docs/plans/2026-03-17-boxed-rehearsal-marks-only.md`

Expected: only the boxed-only detection change, tests, fixture, and docs are present.
