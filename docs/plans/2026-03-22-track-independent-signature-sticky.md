# Track-Independent Signature Sticky Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make clef, key signature, and ordinary time-signature sticky replacement run independently per lane so split tracks can keep different active signatures without cross-lane contamination.

**Architecture:** Keep lane-local `typeBlocks` and `baseWidths` as the source of truth, remove system-wide shared width propagation for ordinary `clef/key/time`, and reserve cross-lane replacement only for explicit shared sticky groups. Add regressions around `调号修复.svg` and tighten Dorico numeric text time-signature admission so split labels such as `1` / `2` do not re-enter the signature pipeline indirectly.

**Tech Stack:** Vanilla JS, Playwright smoke/spec tests, SVG analysis pipeline, sticky layout/render pipeline.

---

### Task 1: Add the failing real-score regression for split-track signature isolation

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a real-score regression for `调号修复.svg` that exposes render/sticky state and asserts the two `Violoncello` lanes can hold independent key/time sticky state instead of collapsing to one shared replacement outcome.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "track-independent clef key and time stickies in 调号修复.svg"`

Expected: FAIL because the current render pass shares `clef/key` width state across the whole system.

### Task 2: Add a focused regression for lane-local key/time offsets

**Files:**
- Modify: `tests/sticky-layout.spec.js`

**Step 1: Write the failing test**

Add a small regression proving one lane can have zero key width while another lane in the same system still carries a non-zero key/time offset.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "signature offsets stay lane-local when sibling lanes diverge"`

Expected: FAIL because the current app logic promotes clef/key widths to shared system maxima.

### Task 3: Make clef/key/time sticky widths lane-local by default

**Files:**
- Modify: `scripts/app.js`

**Step 1: Keep shared groups only for explicit shared sticky items**

Leave `sharedActiveIdx` handling intact for items that already carry `sharedStickyGroupId`.

**Step 2: Remove ordinary system-wide clef/key width aggregation**

Refactor the `systemBaseWidthsBySystem` / `systemActiveWidthsBySystem` path so ordinary lane offsets no longer derive from system maxima for `clef/key/time`.

**Step 3: Compute lane-local offsets**

For each lane:
- `clef` offset should come from that lane’s own active-vs-base clef width
- `key` offset should come from that lane’s own active-vs-base key width
- `time` should continue to sit to the right of that lane’s own active clef/key chain

**Step 4: Run focused tests**

Run: `npx playwright test tests/sticky-layout.spec.js tests/score-scroll-smoke.spec.js --grep "signature offsets stay lane-local when sibling lanes diverge|track-independent clef key and time stickies in 调号修复.svg"`

Expected: PASS.

### Task 4: Tighten Dorico numeric text time-signature admission

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Add the failing regression**

Add a regression locking that split labels like `1` / `2` in `调号修复.svg` do not get promoted into the active time-signature chain.

**Step 2: Restrict numeric-text time-signature candidates**

Update the Dorico text time-signature candidate gating so plain numeric text must satisfy stronger music-context constraints before entering the time-signature candidate list.

**Step 3: Run focused test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "does not treat 调号修复 split labels as time signatures"`

Expected: PASS.

### Task 5: Re-run related signature and sticky regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `tests/sticky-layout.spec.js`

**Step 1: Run sticky-layout regressions**

Run: `npx playwright test tests/sticky-layout.spec.js`

Expected: PASS.

**Step 2: Run signature-related smoke regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "natural-only key signature blocks clear the sticky key display|marks natural-only key signature blocks as sticky clear events|shares giant time-signature sticky activation across lanes when a later cut-time glyph replaces a stacked meter|track-independent clef key and time stickies in 调号修复.svg|does not treat 调号修复 split labels as time signatures"`

Expected: PASS.

**Step 3: Confirm worktree state**

Run: `git status --short`

Expected: only the planned app, analysis, and test files plus these plan docs are modified.
