# Opening Giant Time Signature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Classify visually large opening numeric time signatures so single-line scores keep their opening meter as the first sticky time-signature block and pin the sticky staff bridge from the real staff left edge.

**Architecture:** Keep the existing shared text and path time-signature decoder. Update candidate classification in `scripts/app.js` so giant behavior is derived from rendered geometry as well as decoder metadata, and align the single-line sticky anchor in `scripts/features/svg-analysis.js` with the virtual system start when no physical opening barline exists.

**Tech Stack:** Browser SVG DOM analysis, Playwright smoke tests, JSDoc-typed JavaScript modules.

---

### Task 1: Add the failing regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/fixtures/no-opening-barline-single-staff.svg`
- Test: `tests/fixtures/no-opening-barline-single-staff-bravura.svg`

**Step 1: Write the failing test**

Add a regression that imports `no-opening-barline-single-staff-bravura.svg` and asserts:

- two opening `text.highlight-timesig` glyphs are present
- the highlighted tokens are both `4`
- the display is driven by the recognized opening `4/4`, not the fallback color

Add a second regression that asserts `scripts/features/svg-analysis.js` anchors `stickyMinX` to the virtual system start when `window.hasPhysicalStartBarline === false`.

**Step 2: Run test to verify it fails**

Run:

`npx playwright test tests/score-scroll-smoke.spec.js -g "recognizes visually giant opening Bravura time signatures before later meter changes"`

Expected: FAIL because the opening `4/4` is currently rejected before highlighting and the sticky bridge anchor is not tied to the virtual system start.

### Task 2: Implement the minimal fixes

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/features/svg-analysis.js`

**Step 1: Compute visual giant status**

During time-signature candidate construction, derive a boolean from the candidate rect height and combine it with decoder-provided `isGiant`.

**Step 2: Reuse existing filters**

Keep the current staff-band and start-anchor or barline proximity checks. Only the stacked-partner requirement should change for visually giant numeric candidates.

**Step 3: Align the single-line sticky anchor**

When there is no physical opening barline, set `stickyMinX` from `globalAbsoluteSystemInternalX` so the bridge lines and the pinned opening symbols share the same left-edge reference.

**Step 4: Keep behavior narrow**

Do not change sticky grouping, mask logic, or timeline parsing. The goal is to restore the missing opening time signature block, not alter downstream systems directly.

### Task 3: Remove temporary diagnostics and verify

**Files:**
- Delete: `tests/inspect-sticky-timesig.spec.js`

**Step 1: Remove the temporary inspection test**

Delete the one-off debugging spec once the formal regression is in place.

**Step 2: Run targeted verification**

Run:

`npx playwright test tests/score-scroll-smoke.spec.js -g "recognizes visually giant opening Bravura time signatures before later meter changes"`

Expected: PASS.

**Step 3: Run full verification**

Run:

`npm run typecheck`

`npx playwright test`

Expected: PASS.
