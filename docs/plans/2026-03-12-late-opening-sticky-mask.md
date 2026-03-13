# Late Opening Sticky Mask Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent later mid-score sticky blocks from pinning at score start, and preserve single-line bridge staff lines inside the sticky mask.

**Architecture:** Keep the current sticky lane model, but only treat blocks near `stickyMinX` as opening anchors. Add a second horizontal-line cache dedicated to bridge redraw so lane logic can stay five-line-aware while the mask bridge redraw includes percussion single lines.

**Tech Stack:** Browser-side SVG analysis in `scripts/features/svg-analysis.js`, canvas rendering in `scripts/app.js`, Playwright smoke/import tests in `tests/score-scroll-smoke.spec.js`.

---

### Task 1: Add the failing regressions

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing late-sticky regression**

Add an import-analysis test for `/Users/jaychan/Library/Mobile Documents/com~apple~CloudDocs/__Work_Projects__/__Dorico Projects__/20250518_登山/Scores/01 - Scroll - 登山 - 001.svg` that inspects `buildRenderQueue(svg)` and asserts that later key-signature blocks far from `stickyMinX` do not get `lockDistance === 0`.

**Step 2: Run it to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "does not pin later-only key signatures as opening sticky blocks in Dengshan"`

Expected: FAIL because the first later key-signature block still uses itself as the opening anchor.

**Step 3: Write the failing bridge-line regression**

In the same test file, assert that the Dengshan import returns a bridge-line cache containing more lines than the five-line-only staff cache.

**Step 4: Run it to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps single-line bridge redraw data separate from five-line staff lanes in Dengshan"`

Expected: FAIL because no separate bridge-line cache exists yet.

### Task 2: Implement opening-anchor gating

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/features/svg-analysis.js`

**Step 1: Add an opening-window helper**

Define the opening threshold once near sticky-lane construction and use it to determine whether the first block for a sticky type is truly opening.

**Step 2: Recompute base widths and lock distances**

When a type has no opening block:

- leave `baseWidths[type]` at `0`
- derive `lockDistance` from `stickyMinX` instead of `typeBlocks[type][0].minX`

**Step 3: Keep opening behavior unchanged when a real opening block exists**

Existing opening clef/key/time/bar/brace behavior should remain unchanged for scores that do start with those symbols.

### Task 3: Add a dedicated bridge-line cache

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/features/svg-analysis.js`
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/app.js`

**Step 1: Preserve two horizontal-line collections**

Keep one deduped all-line collection for bridge redraw and one cleaned five-line collection for staff-band logic.

**Step 2: Expose the new bridge-line cache**

Return `globalAbsoluteBridgeLineYs` from `buildRenderQueue(svg)` and store it on `window` during SVG processing.

**Step 3: Use bridge lines in mask redraw**

Switch the mask bridge drawing path in `renderCanvas()` to `window.globalAbsoluteBridgeLineYs`, keeping existing bridge-start anchoring behavior.

### Task 4: Verify the fix

**Files:**
- No code changes required unless regressions appear

**Step 1: Re-run the new regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "does not pin later-only key signatures as opening sticky blocks in Dengshan|keeps single-line bridge redraw data separate from five-line staff lanes in Dengshan"`

Expected: PASS.

**Step 2: Re-run nearby smoke tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes fragmented multi-group barlines in Dengshan imports|anchors no-opening-barline bridge lines to the first visible sticky music glyph"`

Expected: PASS.
