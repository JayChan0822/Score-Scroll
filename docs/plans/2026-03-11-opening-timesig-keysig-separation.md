# Opening Time Signature And Mid-System Key Signature Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve true mid-system key-signature changes while keeping the opening time-signature offset isolated from later time signatures.

**Architecture:** Tighten the SVG classification boundary in `scripts/app.js` so consecutive accidentals immediately after a system-start or mid-system barline cluster can remain `KeySig` when they form a pre-note signature block, while later note-adjacent accidentals still reclassify normally. In `scripts/features/svg-analysis.js`, keep opening time-signature base width local to the opening block so later time-signature blocks use their own real SVG positions instead of inheriting opening compensation.

**Tech Stack:** Vanilla JavaScript, browser SVG DOM geometry, Playwright smoke tests.

---

### Task 1: Lock the regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add one regression that loads `tests/fixtures/zhangchengyao-mid-system-naturals.svg` and asserts the naturals immediately after the double barline before the next note group remain `highlight-keysig`, not `highlight-accidental`.

Add a second regression that loads the same fixture and asserts the opening time-signature block can have an opening offset without shifting a later time-signature block by the same amount.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "preserves mid-system key-signature clusters after a barline|keeps opening time-signature offset isolated from later time signatures"`

Expected: FAIL because the current heuristics downgrade the target naturals and treat opening offset as a shared time-signature baseline.

### Task 2: Fix key-signature preservation

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Teach the accidental reclassification pass to recognize barline-delimited signature windows:

- collect physical barline X positions in screen space
- for each staff band, detect consecutive accidental glyphs that start just after a barline cluster and end before the first notehead or time-signature glyph
- protect only that contiguous block as `highlight-keysig`

Keep the existing contagion pass for all non-protected candidates.

**Step 2: Run the targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "preserves mid-system key-signature clusters after a barline"`

Expected: PASS

### Task 3: Fix opening-time-signature offset leakage

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Separate opening `TimeSig` anchoring from later `TimeSig` blocks:

- keep the opening block width for the opening sticky layout only
- compute later time-signature block lock distances from their own block minima, not from the opening block compensation
- preserve current opening behavior and timeline token extraction

**Step 2: Run the targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "keeps opening time-signature offset isolated from later time signatures"`

Expected: PASS

### Task 4: Verify

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run focused verification**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "preserves mid-system key-signature clusters after a barline|keeps opening time-signature offset isolated from later time signatures|reclassifies mid-system flats adjacent to hollow noteheads instead of leaving them as key signatures|decodes non-MuseScore path time signatures into the timeline"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-11-opening-timesig-keysig-separation.md tests/score-scroll-smoke.spec.js scripts/app.js scripts/features/svg-analysis.js
git commit -m "fix: separate opening time signature offset from later meters"
```
