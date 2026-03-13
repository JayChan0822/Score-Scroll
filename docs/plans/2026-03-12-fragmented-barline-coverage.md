# Fragmented Barline Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote same-`x` fragmented vertical clusters to `TrueBarline` when they collectively cover valid adjacent staff ranges.

**Architecture:** Keep the existing strict barline checks in `initScoreMapping()`, then add one fallback that evaluates per-segment coverage against contiguous staff ranges. Validate with a real-score smoke test and re-run staff-kind time-signature regressions.

**Tech Stack:** Browser-side SVG analysis in `scripts/app.js`, Playwright smoke tests in `tests/score-scroll-smoke.spec.js`.

---

### Task 1: Add the failing regression

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke test for `/Users/jaychan/Library/Mobile Documents/com~apple~CloudDocs/__Work_Projects__/__Dorico Projects__/20250518_登山/Scores/01 - Scroll - 登山 - 001.svg` that waits for analysis, then asserts `barlineCount > 1`, `measureCount > 0`, and `timeSigDisplay !== '-/-'`.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes fragmented multi-group barlines in Dengshan imports"`

Expected: FAIL with `barlineCount` still `1` and `measureCount` still `0`.

### Task 2: Implement fragmented-coverage fallback

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/app.js`

**Step 1: Add helper logic inside `initScoreMapping()`**

Implement a fallback that:

- inspects `cluster.lines`
- matches each segment against contiguous ranges in `staves`
- unions the covered staff indices
- returns true when the cluster covers enough staff slots to be a logical barline

**Step 2: Keep strict checks first**

Preserve the existing exact full-system / single-staff checks, and only use the new range-coverage logic when exact alignment fails.

**Step 3: Re-run the failing smoke**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes fragmented multi-group barlines in Dengshan imports"`

Expected: PASS.

### Task 3: Re-run nearby regressions

**Files:**
- No code changes required unless regressions appear

**Step 1: Re-run related smoke tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "does not treat tablature fingering digits as time signatures in Shounen no Yume|recognizes opening tablature time signatures before fingering digits|recognizes percussion time signatures for non-five-line staves"`

Expected: PASS.

### Task 4: Clean up debug artifacts

**Files:**
- Delete: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/temp-debug.spec.js`

**Step 1: Remove the temporary debug spec**

Delete the file once the real regression is in place.

**Step 2: Re-run the targeted suite**

Run both commands from Task 2 and Task 3 again to confirm clean state after cleanup.
