# Score Source Type Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Classify imported SVG scores as `MuseScore`, `Dorico`, `Sibelius`, or `Unknown` and display that result in the UI.

**Architecture:** Add a centralized source-type detector in `scripts/app.js`, store the result in app state, and derive existing MuseScore-specific behavior from that single classification. Lock the behavior with focused Playwright smoke tests that cover both classification and the new UI label.

**Tech Stack:** Vanilla ES modules, SVG DOM parsing, Playwright smoke tests, static HTML/CSS UI.

---

### Task 1: Add failing regression coverage for source classification

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Create: `tests/fixtures/unknown-score-source.svg`
- Use fixtures: `Dorico Type.svg`, `Musescore Type.svg`, `Sibelius Type.svg`

**Step 1: Write the failing test**

Add one focused smoke test that loads each source fixture and asserts the app exposes the expected classification:

- Dorico fixture => `Dorico`
- MuseScore fixture => `MuseScore`
- Sibelius fixture => `Sibelius`
- Unknown fixture => `Unknown`

Prefer assertions that read runtime state or a DOM-exposed label rather than inspecting internal implementation strings.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "classifies imported score sources as Dorico MuseScore Sibelius or Unknown"`

Expected: FAIL because the app does not yet expose a centralized source-type classification.

### Task 2: Add failing regression coverage for the UI label

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify if needed: `index.html`

**Step 1: Write the failing UI test**

Add a focused smoke test that imports one or more fixtures and asserts the `SOURCES` card label updates to:

- `谱子类型：MuseScore`
- `谱子类型：Dorico`
- `谱子类型：Sibelius`
- `谱子类型：Unknown`

Also assert the initial empty state is `谱子类型：-`.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "shows the detected score source type in the sources card"`

Expected: FAIL because the UI does not yet render a score-source label.

### Task 3: Implement the centralized source classifier

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/core/state.js`

**Step 1: Add a persistent state field**

Extend the app state with a `currentScoreSourceType` string initialized to `Unknown`.

**Step 2: Implement the classification helper**

Add a helper that inspects:

- SVG `<desc>` text
- semantic MuseScore classes
- raw SVG text and/or DOM font-family strings for Sibelius markers

Return only the four allowed values:

- `MuseScore`
- `Dorico`
- `Sibelius`
- `Unknown`

**Step 3: Derive the existing MuseScore branch from the centralized result**

Update `isMuseScoreSvg()` and any import-time booleans so they use the centralized classification instead of duplicating detection logic.

**Step 4: Run the classification regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "classifies imported score sources as Dorico MuseScore Sibelius or Unknown"`

Expected: PASS.

### Task 4: Wire the detected source type into the UI

**Files:**
- Modify: `index.html`
- Modify: `scripts/core/dom.js`
- Modify: `scripts/app.js`

**Step 1: Add the read-only label to the SOURCES card**

Render a compact info row showing `谱子类型：-` by default.

**Step 2: Update the label during SVG lifecycle events**

Set the label when:

- SVG import starts or resets
- SVG import succeeds
- SVG import fails

Keep the displayed text synchronized with the centralized state value.

**Step 3: Run the UI regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "shows the detected score source type in the sources card"`

Expected: PASS.

### Task 5: Verify existing MuseScore behavior still works

**Files:**
- Modify: tests only if narrow expectation cleanup is required

**Step 1: Run focused MuseScore and vendor compatibility checks**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "classifies MuseScore opening semantic classes before signature guessing|classifies imported score sources as Dorico MuseScore Sibelius or Unknown|shows the detected score source type in the sources card|preserves opening barlines, instrument names, and key signatures for transformed Opus SVG imports"`

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Remove temporary diagnostics**

Delete any debug-only logging or temporary fixture plumbing added during implementation before finishing.
