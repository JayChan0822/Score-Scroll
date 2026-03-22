# Tempo Sticky Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect tempo text and metronome-mark groups as a new sticky symbol type and pin them beside rehearsal marks or in the rehearsal column when no rehearsal mark exists.

**Architecture:** Add a hybrid tempo detector in `scripts/app.js` that tags whitelist-based tempo text and music-glyph metronome groups with a new highlight class. Thread that class through `scripts/features/svg-analysis.js` as `TempoMark -> tempo`, then use a small helper in `scripts/features/sticky-layout.mjs` plus render-time offsets in `scripts/app.js` to place pinned tempo marks relative to the active rehearsal block.

**Tech Stack:** Vanilla JavaScript modules, SVG DOM inspection, sticky layout helpers, Playwright regression tests.

---

### Task 1: Add the failing tempo layout helper tests

**Files:**
- Modify: `tests/sticky-layout.spec.js`

**Step 1: Write a failing helper test for right-of-rehearsal tempo spacing**

Add a test that calls a new helper with:
- active rehearsal width present,
- rehearsal active,
- padding set,

and expects the tempo X offset to equal `rehearsalWidth + padding`.

**Step 2: Write a failing helper test for rehearsal-column fallback**

Add a test that calls the same helper with no active rehearsal width and expects `0`.

**Step 3: Run the focused helper tests and verify red**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "tempo marks pin to the right of active rehearsal marks|tempo marks fall back to the rehearsal column when no rehearsal mark is active"`

Expected: FAIL because the helper does not exist yet.

### Task 2: Add the failing tempo smoke regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Create: `tests/fixtures/tempo-sticky.svg`

**Step 1: Create a focused SVG fixture**

Build a small fixture containing:
- an opening clef,
- one rehearsal mark,
- one whitelist tempo text such as `Largo`,
- one metronome-mark group such as `♪ = 56`,
- one later tempo mark without a rehearsal mark partner for fallback coverage.

**Step 2: Write a failing detection regression**

Assert that:
- whitelist tempo text receives tempo classification,
- the glyph and numeric part of the metronome mark are both marked tempo,
- tempo items appear in sticky lane metadata as `tempo` blocks.

**Step 3: Write a failing render regression**

Assert that:
- when a rehearsal mark is active, the pinned tempo block sits to its right,
- when no rehearsal mark is active, the pinned tempo block uses the rehearsal column.

**Step 4: Run the focused smoke tests and verify red**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects tempo text and metronome marks as sticky candidates|pins tempo marks to the right of rehearsal marks and falls back to the rehearsal column"`

Expected: FAIL because tempo detection and sticky placement do not exist.

### Task 3: Implement tempo detection in the DOM-highlighting pass

**Files:**
- Modify: `scripts/app.js`

**Step 1: Add tempo text configuration and normalization helpers**

Add:
- `TEMPO_TEXT_WHITELIST`,
- a normalization helper for whitespace and case,
- a predicate that checks whitelist membership.

**Step 2: Add metronome-mark matching helpers**

Add helpers that:
- identify music-glyph text nodes,
- match tempo-number suffixes like `= 56` and `≈ 48`,
- pair glyph and numeric texts inside the same parent group or close geometry.

**Step 3: Tag tempo candidates**

Add `identifyAndHighlightTempoMarks()` to mark:
- whitelist tempo text,
- glyph text,
- numeric text,

with `.highlight-tempomark`.

**Step 4: Call the detector in the existing highlight pipeline**

Place it after rehearsal detection and before instrument-name detection so tempo text is classified before generic left-side text scanning can claim it.

**Step 5: Run the detection smoke regression and verify green for detection**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects tempo text and metronome marks as sticky candidates"`

Expected: PASS

### Task 4: Thread tempo through sticky analysis and layout helpers

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/features/sticky-layout.mjs`

**Step 1: Add `TempoMark -> tempo` mapping**

Extend symbol typing and sticky type maps so `.highlight-tempomark` becomes sticky type `tempo`.

**Step 2: Preserve tempo block metadata**

Include `tempo` in:
- lane `itemsByType`,
- `typeBlocks`,
- `baseWidths`,
- lock-distance assignment,
- opening-envelope metadata where needed.

**Step 3: Add the tempo horizontal helper**

In `sticky-layout.mjs`, add a helper that returns:
- `rehearsalWidth + padding` when an active rehearsal display width exists,
- `0` otherwise.

**Step 4: Run the focused helper suite and verify green**

Run: `npx playwright test tests/sticky-layout.spec.js --grep "tempo marks pin to the right of active rehearsal marks|tempo marks fall back to the rehearsal column when no rehearsal mark is active"`

Expected: PASS

### Task 5: Apply tempo pin offsets during rendering

**Files:**
- Modify: `scripts/app.js`

**Step 1: Track active tempo widths and active rehearsal widths per lane**

Extend the sticky activation bookkeeping to include `tempo`.

**Step 2: Compute lane tempo offsets**

Use the new helper to compute a per-lane `tempoX` offset from the active rehearsal block display width.

**Step 3: Apply the X offset to pinned tempo items**

In the sticky render loop, apply `targetExtraX = laneOffsets[item.laneId].tempo` for `tempo` items only while pinned.

**Step 4: Run the focused smoke regressions and verify green**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects tempo text and metronome marks as sticky candidates|pins tempo marks to the right of rehearsal marks and falls back to the rehearsal column"`

Expected: PASS

### Task 6: Re-run related regressions and refresh module versions

**Files:**
- Modify: `scripts/app.js` import version strings if cache busting is needed

**Step 1: Re-run sticky layout coverage**

Run: `npx playwright test tests/sticky-layout.spec.js`

Expected: PASS

**Step 2: Re-run tempo and rehearsal smoke coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "detects tempo text and metronome marks as sticky candidates|pins tempo marks to the right of rehearsal marks and falls back to the rehearsal column|threads rehearsal marks into sticky lane replacement order|keeps tightly enclosed Dorico rehearsal-mark frames attached to their letters|keeps lower-system rehearsal E and F on the same sticky lane despite vertical drift"`

Expected: PASS

**Step 3: Run type checking**

Run: `npx tsc -p tsconfig.json`

Expected: PASS
