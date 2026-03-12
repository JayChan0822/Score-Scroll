# KeySig Accidental Classification Revert Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Revert the final mid-score key-signature classification to note-adjacent accidental seeding plus contagion while preserving trusted anchor filtering.

**Architecture:** Keep the current trusted barline anchor pipeline and staff-aware candidate grouping, but replace the suffix-splitting logic inside `classifyAccidentalGroups()` with a notehead-distance-first accidental classifier. Use TDD to lock the `长城谣` regression before changing the classifier, then verify existing `武则天` and piano-sharp regressions still pass.

**Tech Stack:** Browser SVG analysis, Playwright smoke tests, ESM module helpers in `scripts/features`

---

### Task 1: Lock The Regression

**Files:**
- Modify: `tests/symbol-graph.spec.js`
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/symbol-graph.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add:
- A pure `symbol-graph` regression where a key-signature prefix is followed by a note-adjacent accidental suffix; the prefix must stay `keysig`, the suffix must become `accidental`
- A `长城谣` smoke regression that locks the flat cluster near `x≈1599` and the sharp cluster near `x≈2645`

**Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/symbol-graph.spec.js --grep "preserves a key-signature prefix"`  
Expected: FAIL

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preserves Changchengyao mid-score key-signature clusters with note-adjacent accidental suffixes"`  
Expected: FAIL

### Task 2: Revert The Classification Logic

**Files:**
- Modify: `scripts/features/symbol-graph.mjs`
- Test: `tests/symbol-graph.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Update `classifyAccidentalGroups()` so that it:
- marks note-adjacent candidates as accidental seeds per staff lane
- spreads accidental contagion to nearby same-lane candidates in the same local cluster
- assigns trusted-anchor key signatures from the remaining leading candidates

**Step 2: Run tests to verify they pass**

Run: `npx playwright test tests/symbol-graph.spec.js --grep "preserves a key-signature prefix"`  
Expected: PASS

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "preserves Changchengyao mid-score key-signature clusters with note-adjacent accidental suffixes"`  
Expected: PASS

### Task 3: Verify Adjacent Regressions

**Files:**
- Test: `tests/symbol-graph.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run focused regression coverage**

Run: `npx playwright test tests/symbol-graph.spec.js`
Expected: PASS

Run: `npx playwright test --config=/var/folders/y4/06075bnd4cd3blcpbt70nn180000gr/T/changcheng-debug.4XVmu1/playwright.local.config.js tests/score-scroll-smoke.spec.js --grep "preserves Changchengyao mid-score key-signature clusters with note-adjacent accidental suffixes|keeps piano upper-staff measure-23 key-signature sharps separate from later accidentals in Changchengyao|classifies Wu Zetian mid-score naturals and flats with the shared symbol graph"`
Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-12-keysig-accidental-classification-revert-design.md docs/plans/2026-03-12-keysig-accidental-classification-revert.md scripts/features/symbol-graph.mjs tests/symbol-graph.spec.js tests/score-scroll-smoke.spec.js
git commit -m "fix: restore note-adjacent accidental classification"
```
