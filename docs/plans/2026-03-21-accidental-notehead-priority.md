# Accidental Notehead Priority Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make notehead adjacency outrank key-signature classification, including at system starts.

**Architecture:** Keep the shared symbol-graph logic intact and add one explicit post-classification override in `scripts/app.js`. That override will scan all accidental candidates against nearby noteheads and force note-adjacent candidates into the accidental set before final class application.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests

---

### Task 1: Add a failing regression test

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Add a minimal two-system SVG builder**

Create an SVG with:
- two staff systems separated far enough to count as different systems
- one flat candidate near a notehead at the start of system 1
- one flat candidate near a notehead at the start of system 2

Use a notehead gap that is clearly note-adjacent for product behavior but not dependent on an earlier barline anchor.

**Step 2: Add a smoke test**

Assert both flat candidates become:
- `highlight-accidental`
- not `highlight-keysig`

**Step 3: Verify RED**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "prioritizes note-adjacent accidentals over key signatures at system starts"`

Expected:
- FAIL because the current rescue path still depends on previous barline anchors and flat-only logic.

### Task 2: Implement unified notehead-priority override

**Files:**
- Modify: `scripts/app.js`

**Step 1: Add a reusable notehead-proximity helper**

Define one helper that:
- accepts an accidental candidate and noteheads
- checks same-band or tightly aligned fallback
- uses explicit X/Y proximity thresholds

**Step 2: Apply the override to all accidental candidates**

After the existing classification result is built:
- iterate all accidental candidates
- if the helper reports a nearby notehead:
  - `keySignatureIds.delete(candidate.id)`
  - `accidentalIds.add(candidate.id)`

Do not require:
- previous barline anchors
- flat-only kinds

### Task 3: Verify

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the new targeted regression**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "prioritizes note-adjacent accidentals over key signatures at system starts"`

Expected:
- PASS

**Step 2: Run nearby accidental/key-signature regressions**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "reclassifies flats near ellipse noteheads that sit slightly away from the staff|reclassifies mid-system flats adjacent to hollow noteheads instead of leaving them as key signatures|preserves mid-system key-signature clusters after a double barline"`

Expected:
- PASS

**Step 3: Run static verification**

Run:
`npm run typecheck`

Expected:
- PASS
