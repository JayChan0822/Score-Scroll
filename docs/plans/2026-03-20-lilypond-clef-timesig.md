# LilyPond Clef/Time Signature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add LilyPond source detection and LilyPond-specific clef/time-signature recognition without regressing the existing MuseScore, Dorico, Sibelius, and Unknown pipelines.

**Architecture:** Add a new `LilyPond` source type, detect it from export-specific SVG markers, and thread that source through the existing analysis profile. For LilyPond clef/time-signature paths, keep the current matching flow first and retry with a LilyPond-normalized path signature so registry-backed matches still work when LilyPond emits `H`/`V`-heavy path commands.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests, SVG DOM analysis, path-signature lookup.

---

### Task 1: Lock in the failing LilyPond behaviors

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Create: `tests/fixtures/score-source-lilypond.svg`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

- Extend the source-detection matrix to expect `score-source-lilypond.svg` to classify as `LilyPond`.
- Add a LilyPond clef/time-signature smoke test using a LilyPond-styled fixture whose paths require LilyPond-specific signature normalization before they can match the registry.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "LilyPond"`
Expected: FAIL because `LilyPond` is not yet a recognized source type and the LilyPond fixture is not yet highlighted.

**Step 3: Write minimal implementation**

- Add the new source type constant.
- Detect LilyPond in the imported SVG.
- Add LilyPond-specific path-signature fallback logic for clef and time-signature recognition.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "LilyPond"`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/score-scroll-smoke.spec.js tests/fixtures/score-source-lilypond.svg scripts/app.js scripts/features/score-analysis-profile.js docs/plans/2026-03-20-lilypond-clef-timesig-design.md docs/plans/2026-03-20-lilypond-clef-timesig.md
git commit -m "feat: add lilypond clef and timesig detection"
```

### Task 2: Run focused regression coverage

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the focused suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "score source|LilyPond"`
Expected: PASS for Dorico, MuseScore, Sibelius, Unknown, and LilyPond source detection plus the LilyPond clef/time-signature smoke.

**Step 2: Run the nearby regression slice**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "clef|timesig"`
Expected: PASS for the nearby clef and time-signature smoke coverage.

**Step 3: Commit**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: cover lilypond source regressions"
```
