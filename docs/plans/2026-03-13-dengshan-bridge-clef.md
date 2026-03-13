# Dengshan Bridge Line And Clef Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Filter sticky bridge redraw down to true full-span score lines and give single-line percussion clefs their own sticky lanes/blocks.

**Architecture:** Filter raw horizontal staff-line candidates into a dedicated full-span bridge-line cache, then build sticky lanes from that cache so one-line percussion staves are represented. Keep clef grouping strict so adjacent clefs never merge into one sticky block.

**Tech Stack:** Vanilla JS, Playwright smoke tests, SVG geometry analysis.

---

### Task 1: Add bridge-line regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a Dengshan regression that imports `scripts/features/svg-analysis.js`, builds the render queue for the real SVG, finds the `Piano` instrument row, and asserts the nearby bridge redraw cache only contains 10 full-span lines.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps Dengshan piano bridge redraw limited to true full-span staff lines"`

**Step 3: Write minimal implementation**

Adjust bridge-line collection/filtering in `scripts/features/svg-analysis.js`.

**Step 4: Run test to verify it passes**

Run the same command and confirm it passes.

### Task 2: Add timpani clef isolation regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a Dengshan regression that builds sticky lanes with a clef signature resolver and asserts the `Timpani` lane has exactly one opening clef block item.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps Dengshan timpani opening bass clef isolated in its own sticky lane and block"`

**Step 3: Write minimal implementation**

Build sticky lanes from the filtered bridge-line cache and isolate clef blocks.

**Step 4: Run test to verify it passes**

Run the same command and confirm it passes.

### Task 3: Verify both regressions together

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run focused verification**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps Dengshan piano bridge redraw limited to true full-span staff lines|keeps Dengshan timpani opening bass clef isolated in its own sticky lane and block|keeps single-line bridge redraw data separate from five-line staff lanes in Dengshan"`

**Step 2: Confirm real behavior**

Check that all listed tests pass and no temporary debug files remain.
