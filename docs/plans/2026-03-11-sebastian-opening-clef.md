# Sebastian Opening Clef Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recognize Dorico `Sebastian` opening treble clefs that use an unregistered path-signature variant.

**Architecture:** Keep the clef detection pipeline unchanged and fill the missing registry entry. Protect the fix with a regression test that exercises the real Dorico fixture already in the repo.

**Tech Stack:** Browser SVG parsing, Playwright smoke tests, static music-font registry.

---

### Task 1: Add the failing regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/fixtures/no-opening-barline-single-staff.svg`

**Step 1: Write the failing test**

Add a smoke test that loads `no-opening-barline-single-staff.svg`, finds the leftmost `path.highlight-clef`, and asserts it exists near the system start.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "recognizes the Sebastian opening treble clef variant in the no-opening-barline fixture"`

Expected: FAIL because the opening clef is not highlighted.

### Task 2: Patch the registry

**Files:**
- Modify: `scripts/data/music-font-registry.js`

**Step 1: Write minimal implementation**

Add the missing `Sebastian` treble-clef signature:

`MCCCCCCCCLCCCLMCCCCCCMCCLCCMCCCCCCCCCCCCCLLCCCCCCCCCCCCL`

to the `Treble Clef (高音谱号)` signature list.

**Step 2: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "recognizes the Sebastian opening treble clef variant in the no-opening-barline fixture"`

Expected: PASS.

### Task 3: Run verification

**Files:**
- Modify: none

**Step 1: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run smoke suite**

Run: `npx playwright test`

Expected: PASS.
