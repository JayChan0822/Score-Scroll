# Rehearsal Mark Sticky Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect rehearsal marks in bare and enclosed forms, classify them as a new sticky symbol type, and keep them pinned on the left during playback.

**Architecture:** Extend SVG analysis with a rehearsal-mark pass that identifies uppercase rehearsal text and optionally pairs it with enclosing rectangle, rounded-rectangle, or circle geometry. Feed those elements into the render queue as a new `RehearsalMark` symbol type, then add a `reh` sticky category to the existing sticky lane/block system.

**Tech Stack:** Vanilla JavaScript modules, DOM/SVG geometry inspection, Canvas 2D render pipeline, Playwright smoke tests.

---

### Task 1: Add failing rehearsal-mark tests

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Add minimal static/runtime coverage**

Add tests that prove:
- rectangle / rounded rectangle / circle rehearsal marks are detected
- bare `A` and `AA` rehearsal text is detected
- rehearsal marks are threaded into sticky lane classification as a new sticky type

**Step 2: Add sticky replacement coverage**

Add a focused test ensuring later rehearsal marks replace earlier ones when they reach the sticky onset column.

**Step 3: Run tests to verify red**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "detects boxed and bare rehearsal marks as sticky candidates|replaces earlier rehearsal marks with later ones in sticky lanes"`

Expected: FAIL

### Task 2: Detect rehearsal marks during SVG analysis

**Files:**
- Modify: `scripts/features/svg-analysis.js`

**Step 1: Add rehearsal-mark candidate helpers**

Implement text matching and enclosure pairing helpers for uppercase rehearsal labels and nearby frames.

**Step 2: Mark rehearsal elements**

Assign a new CSS class / symbol type path so text and any matching enclosure geometry are tagged as rehearsal marks before the render queue is finalized.

**Step 3: Re-run focused detection tests**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "detects boxed and bare rehearsal marks as sticky candidates"`

Expected: PASS

### Task 3: Thread rehearsal marks into sticky lanes

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/app.js` only if symbol highlighting or color routing needs extending

**Step 1: Add sticky mapping**

Teach `getSymbolType`, `stickyTypesMap`, lane width bookkeeping, and block formation about `RehearsalMark`.

**Step 2: Keep framed marks unified**

Ensure boxed rehearsal text and its enclosure share the same block metadata so they pin together.

**Step 3: Re-run sticky replacement tests**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "replaces earlier rehearsal marks with later ones in sticky lanes"`

Expected: PASS

### Task 4: Run related regressions and refresh cache

**Files:**
- Modify: `index.html` if cache busting is needed

**Step 1: Bump app version**

Update the app module version so the browser loads the new rehearsal-mark behavior.

**Step 2: Run regression coverage**

Run:
`npx playwright test tests/score-scroll-smoke.spec.js --grep "detects boxed and bare rehearsal marks as sticky candidates|replaces earlier rehearsal marks with later ones in sticky lanes|adds an independent sticky lock slider beneath the scanline control|uses separate horizontal ratios for the scanline and sticky lock onset column|fills Light-theme MP4 export frames with the active background color"`

Expected: PASS
