# Mid-Clef Block Splitting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep consecutive mid-system clef changes in the same lane as separate sticky blocks so later clefs can replace earlier ones.

**Architecture:** Extend `svg-analysis` with a clef-specific block break rule while keeping the generic sticky clustering for every other symbol type. Cover the change with one minimal analysis regression and one real-score smoke regression before editing production logic.

**Tech Stack:** Browser SVG analysis, Playwright smoke tests, ESM modules in `scripts/features`

---

### Task 1: Lock The Regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add:
- A browser-side analysis regression that imports `createSvgAnalysisFeature()` and verifies adjacent treble/bass clefs form two `clef` blocks.
- A smoke regression for `/Users/jaychan/Library/Mobile Documents/com~apple~CloudDocs/__Work_Projects__/__Dorico Projects__/20250907_我爱你中国/Scores/03 - Scrolling - 我爱你中国 - 001.svg` that checks the measure-34 piano lower-staff clefs occupy separate sticky blocks.

**Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "splits adjacent treble and bass clefs into separate sticky blocks|keeps consecutive piano lower-staff clef changes as separate sticky blocks in Wo Ai Ni Zhongguo"`

Expected: FAIL because the current clef grouping merges both clefs into one block.

### Task 2: Implement Clef-Specific Block Breaking

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Add a helper that:
- Identifies the current and next clef type with `identifyClefOrBrace()`
- Forces a new block when two adjacent lane clefs represent different clef identities
- Leaves the existing generic threshold behavior unchanged for non-clef types

**Step 2: Run tests to verify they pass**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "splits adjacent treble and bass clefs into separate sticky blocks|keeps consecutive piano lower-staff clef changes as separate sticky blocks in Wo Ai Ni Zhongguo"`

Expected: PASS

### Task 3: Verify Nearby Regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run targeted regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes the Sebastian opening treble clef variant in the no-opening-barline fixture|classifies MuseScore opening semantic classes before signature guessing|splits adjacent treble and bass clefs into separate sticky blocks|keeps consecutive piano lower-staff clef changes as separate sticky blocks in Wo Ai Ni Zhongguo"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-12-mid-clef-block-splitting-design.md docs/plans/2026-03-12-mid-clef-block-splitting.md tests/score-scroll-smoke.spec.js scripts/features/svg-analysis.js
git commit -m "fix: split adjacent mid-system clef sticky blocks"
```
