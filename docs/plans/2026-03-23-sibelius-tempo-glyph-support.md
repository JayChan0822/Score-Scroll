# Sibelius Tempo Glyph Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recognize Sibelius tempo marks that use a note-glyph text character plus an `=number` text run, such as `Grave q =75`.

**Architecture:** Keep the fix inside the tempo-mark detection pipeline. Add a narrow Sibelius-only note-glyph whitelist for common Sibelius font families, then reuse the existing glyph-number pairing and sticky tempo grouping behavior.

**Tech Stack:** Playwright smoke tests, browser-side SVG DOM analysis, `scripts/app.js`

---

### Task 1: Add the failing Sibelius tempo regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a minimal SVG buffer helper that mimics the real Sibelius export structure for `Grave q =75`, then add a smoke test that expects `Grave`, `q`, and `=75` to all gain `highlight-tempomark`.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects Sibelius note-glyph tempo marks"`

Expected: FAIL because the Sibelius note glyph is not currently recognized as a tempo glyph candidate.

### Task 2: Support Sibelius tempo glyph fonts

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write minimal implementation**

Add a narrow helper for Sibelius tempo glyph text that:
- only runs for Sibelius source analysis
- only allows single-character note-glyph tokens
- only allows known Sibelius glyph fonts

Then integrate it into `isTempoMusicGlyphText()` without widening non-Sibelius tempo detection.

**Step 2: Run targeted tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects Sibelius note-glyph tempo marks"`

Expected: PASS

### Task 3: Verify adjacent tempo behavior

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `scripts/app.js`

**Step 1: Re-run nearby tempo regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects tempo text and metronome marks as sticky candidates|detects real-world tempo marks in 速度吸顶.svg|detects dotted-note metronome marks in Ardor.svg|detects Sibelius note-glyph tempo marks"`

Expected: PASS
