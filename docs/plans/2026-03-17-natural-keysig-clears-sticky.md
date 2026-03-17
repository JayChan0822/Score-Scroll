# Natural-Only Key Signature Clears Sticky Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Treat natural-only key-signature change blocks as a sticky clear event so the pinned key signature disappears back to C major/minor after the change point.

**Architecture:** Detect natural-only `KeySig` blocks inside `svg-analysis.js`, keep them in the block timeline so they still advance key-signature replacement timing, but assign them zero sticky display width and skip registering their items as sticky drawables. Update sticky width consumption in `app.js` so the empty key slot propagates correctly to later pinned time signatures.

**Tech Stack:** Vanilla JS, Playwright unit/spec tests, SVG analysis and sticky layout pipeline.

---

### Task 1: Add the failing sticky-layout regression

**Files:**
- Modify: `tests/sticky-layout.spec.js`

**Step 1: Write the failing test**

Add a regression that asserts a `key` block marked as clearing the signature contributes `0` sticky display width, while ordinary key-signature blocks still keep their measured width.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "natural-only key signature blocks clear the sticky key display"`

Expected: FAIL because the current sticky-layout helpers have no concept of a key-clearing block.

### Task 2: Add the failing render-queue regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a render-queue regression that builds a minimal score with an opening sharp/flat key signature followed by a natural-only `KeySig` block, then asserts:
- the natural-only block is flagged as clearing the signature
- its sticky display width is `0`
- its items are not registered as sticky drawables

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sticky-layout.spec.js tests/score-scroll-smoke.spec.js --grep "natural-only key signature blocks clear the sticky key display|marks natural-only key signature blocks as sticky clear events"`

Expected: FAIL because `svg-analysis.js` currently treats the block like a normal pinned key signature.

### Task 3: Implement natural-only key-signature clearing

**Files:**
- Modify: `scripts/features/sticky-layout.mjs`
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/app.js`

**Step 1: Add minimal sticky-width helper**

Introduce a helper in `sticky-layout.mjs` that returns `0` for `key` blocks flagged as clearing the signature and returns the measured width otherwise.

**Step 2: Detect and annotate clear blocks**

Pass accidental identification into `createSvgAnalysisFeature()`, detect when every item in a `KeySig` block is a natural, and annotate the block with `clearsKeySignature` plus `stickyWidth`.

**Step 3: Skip sticky registration for clear-block items**

Keep the block in `typeBlocks.key` so lock distances still work, but do not set `item.isSticky` for its items.

**Step 4: Consume sticky display width**

Update `app.js` to use block sticky display width instead of raw block width when computing active key width and system key offsets.

**Step 5: Run focused tests**

Run: `npx playwright test tests/sticky-layout.spec.js tests/score-scroll-smoke.spec.js --grep "natural-only key signature blocks clear the sticky key display|marks natural-only key signature blocks as sticky clear events"`

Expected: PASS.

### Task 4: Re-verify existing key-signature sticky behavior

**Files:**
- Modify: `tests/sticky-layout.spec.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the targeted key-signature sticky suite**

Run: `npx playwright test tests/sticky-layout.spec.js tests/score-scroll-smoke.spec.js --grep "late-only key signatures do not add synthetic padding when no opening key slot exists|does not pin later-only key signatures as opening sticky blocks in Dengshan|does not add synthetic key padding for Ardor late-only sticky key signatures|natural-only key signature blocks clear the sticky key display|marks natural-only key signature blocks as sticky clear events"`

Expected: PASS.

**Step 2: Confirm only intended files changed**

Run: `git status --short`

Expected: only the sticky-layout, svg-analysis, app, tests, and new plan docs for this change are modified.
