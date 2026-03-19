# Fragmented Meter Revival Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore anchored fragmented `4/4` recognition so Wu Zetian-style opening and later large meters flow through highlighting, timeline, and sticky rendering.

**Architecture:** Keep the strict stacked-path detector as the primary classifier. Add a constrained fragmented-meter fallback inside `identifyAndHighlightTimeSignatures()` that only promotes staff-valid, anchor-aligned fragmented `4/4` clusters, then rely on the existing `highlight-timesig` consumers in `svg-analysis` and timeline extraction.

**Tech Stack:** Vanilla JavaScript, SVG DOM geometry analysis, Playwright smoke tests.

---

### Task 1: Lock the desired fragmented-meter behavior in smoke tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing opening regression**

Update the existing Wu Zetian opening test so it asserts that the opening fragmented large `4/4` becomes highlighted near the system start and contributes `4/4` display state.

**Step 2: Run the focused opening test to verify it fails**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian opening fragmented"`
Expected: FAIL because the current strict detector still rejects the opening fragmented meter.

**Step 3: Write the failing later/sticky regression**

Update the existing Wu Zetian later fragmented test so it asserts that a later fragmented `4/4` produces highlighted glyphs and a later sticky `time` block in the expected lane.

**Step 4: Run the focused later test to verify it fails**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian later fragmented"`
Expected: FAIL because later fragmented meters are still absent from the sticky pipeline.

### Task 2: Add a constrained fragmented `4/4` fallback

**Files:**
- Modify: `scripts/app.js`

**Step 1: Implement the minimal fragmented-cluster collector**

Add a helper that scans non-highlighted geometric fragments near trusted anchors, groups top and bottom `4` fragments by anchor column and staff band, and builds candidate fragmented `4/4` pairs.

**Step 2: Implement the false-positive guardrails**

Reject fragmented candidates unless they:
- sit inside an eligible staff band,
- align with a trusted system-start or barline anchor,
- form a top/bottom pair with stable vertical spacing,
- avoid known notehead-adjacent and decorative-fragment overlap cases.

**Step 3: Promote accepted fragments through the normal time-signature path**

Mark accepted elements with `highlight-timesig`, set `data-time-sig-token="4"`, and attach `data-time-sig-anchor-x` so downstream analysis treats them as ordinary time-signature items.

**Step 4: Run the focused fragmented-meter tests to verify they pass**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian opening fragmented|Wu Zetian later fragmented"`
Expected: PASS.

### Task 3: Re-verify stacked and false-positive protections

**Files:**
- Modify: none unless a test name or assertion needs final polish

**Step 1: Run the fragmented negative regressions**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "fragmented-four shapes as late time signatures when another filled glyph already occupies their note area|boxed noteheads as fragmented time signatures"`
Expected: PASS.

**Step 2: Run the strict numeric baseline regressions**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "non-power-of-two stacked numeric time signatures|MuseScore opening path time signatures paired|stacked opening time signatures while rejecting short stems"`
Expected: PASS.

**Step 3: Run a combined focused suite**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "Wu Zetian|fragmented|stacked opening time signatures|non-power-of-two stacked numeric"`
Expected: PASS.

### Task 4: Final verification and cleanup

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Review the final diff for unintended spillover**

Confirm the implementation is limited to fragmented-meter fallback and the targeted smoke expectations.

**Step 2: Re-run the exact focused commands used above**

Expected: all remain PASS with no new unrelated failures.
