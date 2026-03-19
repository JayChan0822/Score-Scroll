# Strict Stacked Time Signature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore numeric time-signature detection to strict stacked-pair confirmation and remove fragmented geometric fallback from the main pipeline.

**Architecture:** Keep a single classification path in `identifyAndHighlightTimeSignatures()`. Numeric candidates may be collected from decoded text/path glyphs, but they only become `TimeSig` after `getValidStackedTimeSignaturePair()` succeeds. Timeline extraction must only accept confirmed numeric pairs and explicit common/cut meters.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests, SVG DOM analysis.

---

### Task 1: Lock the desired behavior in tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add assertions that:
- stacked numeric time signatures still classify,
- fragmented-four geometric shapes do not classify as opening or late time signatures,
- timeline extraction does not infer `4/4` from a lone numeric token.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "time signatures"`

Expected: failure from current fragmented-four behavior or weak timeline inference.

**Step 3: Write minimal implementation**

No production change in this task.

**Step 4: Run test to verify it still fails**

Run the same command and confirm the failure still points to the intended behavior gap.

### Task 2: Remove geometric fragmented-four time-signature fallback

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write the failing test**

Use the tests from Task 1.

**Step 2: Run test to verify it fails**

Run the focused grep command and confirm failures remain.

**Step 3: Write minimal implementation**

Remove `identifyAndHighlightGeometricOpeningFours()` and `identifyAndHighlightLateFragmentedFours()` from the main time-signature flow, and delete any now-unused helper logic that directly promotes fragmented-four geometry to `highlight-timesig`.

**Step 4: Run test to verify it passes**

Run the focused grep command and confirm fragmented-four cases are rejected while stacked cases still pass.

### Task 3: Tighten numeric timeline extraction

**Files:**
- Modify: `scripts/features/timeline.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add or refine a regression showing a single numeric token must not become `n/4`.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "single numeric token"`

Expected: failure showing timeline still infers `/4`.

**Step 3: Write minimal implementation**

Update `extractTimeSignatures()` so numeric meters require at least two numeric tokens. Continue to allow explicit `COMMON` and `CUT`.

**Step 4: Run test to verify it passes**

Run the targeted grep command and confirm the new regression passes.

### Task 4: Verify the focused regression set

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/features/timeline.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the focused regression suite**

Run:
`./node_modules/.bin/playwright test tests/score-scroll-smoke.spec.js --grep "time signatures|Wu Zetian|fragmented-four|single numeric token"`

**Step 2: Inspect output**

Confirm which cases pass and which still fail.

**Step 3: Make only the minimal follow-up fix if needed**

Adjust pair confirmation or timeline grouping only if the focused suite reveals a real remaining gap.

**Step 4: Re-run the focused regression suite**

Run the same command and record the fresh output before reporting status.
