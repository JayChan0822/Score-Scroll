# Dorico Time Signature Cross-Font Matching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let Dorico time-signature detection accept valid glyphs from any recognized time-signature font so mixed-font files like `武则天.svg` recover their missing opening meters.

**Architecture:** Keep `buildScoreAnalysisProfile()` and dominant-font selection unchanged for the rest of the score pipeline. In `identifyAndHighlightTimeSignatures()`, remove the Dorico dominant-font equality gate from time-signature text/path candidate collection and rely on the shared time-signature decoders plus existing staff/anchor/stack validations to decide what becomes a real time signature. Do not change the separate fragmented-meter fallback behavior; the later Wu Zetian fragmented case stays outside this fix.

**Tech Stack:** Vanilla JavaScript, SVG DOM analysis, Playwright smoke tests.

---

### Task 1: Lock the mixed-font Dorico behavior with failing smoke tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Update the Wu Zetian opening regression**

Change the opening test so it expects nearby highlighted giant `4` glyphs and a white `4/4` display instead of zero highlighted time signatures.

**Step 2: Run the opening regression and verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian opening fragmented"`
Expected: FAIL because the Bravura glyphs are still filtered before time-signature decoding.

**Step 3: Update the later Wu Zetian sticky regression**

Change the later test so it expects highlighted late time-signature glyphs and late sticky `time` blocks in the `Pipa` lane.

**Step 4: Run the later regression and verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian later fragmented"`
Expected: FAIL because the mixed-font Dorico glyphs are still excluded from the time-signature pipeline.

### Task 2: Remove the Dorico dominant-font gate from time-signature candidate collection only

**Files:**
- Modify: `scripts/app.js`

**Step 1: Relax Dorico text time-signature candidate filtering**

Delete the `normalizedFontFamily === getAnalysisMusicFont()` requirement in the text branch of `identifyAndHighlightTimeSignatures()`. Continue requiring `decodeTimeSignatureText()` to succeed.

**Step 2: Relax Dorico path time-signature candidate filtering**

Delete the explicit `resolvedFontFamily !== getAnalysisMusicFont()` early return in the path branch. Continue requiring `decodeTimeSignaturePath()` to succeed before collecting the candidate.

**Step 3: Keep all downstream validations intact**

Do not modify staff-band legality, anchor proximity, giant handling, stacked-pair checks, or timeline parsing.

### Task 3: Verify the restored behavior and protect the baseline

**Files:**
- Modify: none unless assertions need final adjustment

**Step 1: Run the focused Wu Zetian mixed-font regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian opening fragmented Bravura|Wu Zetian later fragmented time signatures"`
Expected: PASS, with the opening mixed-font acceptance restored and the later fragmented rejection still green.

**Step 2: Re-run the nearby negative regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "fragmented-four shapes as late time signatures when another filled glyph already occupies their note area|Wu Zetian pipa boxed noteheads"`
Expected: PASS.

**Step 3: Re-run time-signature baselines**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes visually giant opening Bravura time signatures before later meter changes|recognizes non-power-of-two stacked numeric time signatures in Dorico imports|keeps MuseScore opening path time signatures paired when short horizontal lines pollute staff-band spacing"`
Expected: PASS.

### Task 4: Final diff review

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Confirm the final diff is limited to Dorico time-signature matching**

Review the diff and make sure no non-time-signature detector behavior was changed.

**Step 2: Re-run the exact focused commands above**

Expected: all remain PASS.
