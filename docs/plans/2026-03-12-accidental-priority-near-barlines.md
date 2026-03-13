# Accidental Priority Near Barlines Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure note-adjacent or contagion-adjacent accidentals outrank nearby trusted barline anchors, so borderline mid-score accidentals do not remain classified as key signatures.

**Architecture:** Keep the shared symbol-graph classifier, but slightly relax accidental seed detection and make accidental seed/contagion classification happen before key-signature preservation. Validate with one pure symbol-graph test and one real-score smoke regression.

**Tech Stack:** Browser-side SVG classification in `scripts/features/symbol-graph.mjs`, Playwright unit/smoke tests in `tests/symbol-graph.spec.js` and `tests/score-scroll-smoke.spec.js`.

---

### Task 1: Add the failing regressions

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/symbol-graph.spec.js`
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js`

**Step 1: Write the pure function failing test**

Add a `classifyAccidentalGroups()` test covering a sharp that sits near a trusted barline anchor but is also close enough to a nearby note/accidental cluster that it should classify as accidental.

**Step 2: Run it to verify it fails**

Run: `npx playwright test tests/symbol-graph.spec.js --grep "prefers note-adjacent accidentals over nearby barline anchors"`

Expected: FAIL because the candidate still remains in `keySignatureIds`.

**Step 3: Write the Dengshan smoke failing test**

Add a smoke regression for measure 46 piano lower staff in the Dengshan import, asserting the targeted sharp ends as `highlight-accidental`.

**Step 4: Run it to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "reclassifies Dengshan measure-46 piano-lower sharp as an accidental despite nearby barline anchors"`

Expected: FAIL because the sharp still remains `highlight-keysig`.

### Task 2: Implement the priority fix

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/features/symbol-graph.mjs`

**Step 1: Relax the accidental seed threshold slightly**

Adjust the horizontal seed maximum so borderline note-attached accidentals in compact staves still become seeds.

**Step 2: Preserve accidental priority**

Keep seeded and infected accidental groups out of the key-signature candidate pool so contagion continues to outrank barline proximity.

**Step 3: Re-run the failing tests**

Run both commands from Task 1 again.

Expected: PASS.

### Task 3: Re-run nearby regressions

**Files:**
- No code changes unless regressions appear

**Step 1: Re-run current accidental/key-signature balance tests**

Run: `npx playwright test tests/symbol-graph.spec.js --grep "note-adjacent geometric natural groups classify as accidentals without a trusted anchor|key-signature groups require a trusted anchor and a clear right boundary before noteheads|splits leading key-signature candidates from later note-adjacent accidentals in the same anchor window|preserves a key-signature prefix when stacked note-adjacent accidental suffixes follow"`

Expected: PASS.

**Step 2: Re-run affected score smoke tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "classifies Wu Zetian mid-score naturals and flats with the shared symbol graph|keeps piano upper-staff measure-23 key-signature sharps separate from later accidentals in Changchengyao|preserves Changchengyao mid-score key-signature clusters with note-adjacent accidental suffixes|reclassifies Dengshan measure-46 piano-lower sharp as an accidental despite nearby barline anchors"`

Expected: PASS.
