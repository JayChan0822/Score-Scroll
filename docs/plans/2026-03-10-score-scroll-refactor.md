# Score Scroll Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the static Score Scroll app into maintainable HTML, CSS, and ES module files without intentionally changing the current UI or behavior.

**Architecture:** Keep the app as a static site served locally over HTTP, extract CSS and JavaScript from the single HTML file, centralize state and DOM access, and split logic into focused feature modules. Add a minimal browser smoke test first so the refactor has a repeatable guardrail.

**Tech Stack:** Static HTML, CSS, native ES modules, Node.js, `mp4-muxer`, Playwright smoke tests, local HTTP server

---

### Task 1: Add a repeatable smoke-test baseline

**Files:**
- Create: `playwright.config.js`
- Create: `tests/score-scroll-smoke.spec.js`
- Modify: `package.json`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Create a browser smoke test that:

- opens `/index 优化版.html` through a local server
- expects the page title to contain `Score Scroll`
- expects `#viewport`, `#score-canvas`, `#playBtn`, `#svgInput`, and `#exportVideoBtn` to exist

The first run should fail because Playwright config and test wiring do not exist yet.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: FAIL because the test or config is missing.

**Step 3: Write minimal implementation**

- Add `playwright.config.js` with a local web server command.
- Add the smoke spec.
- Add a `test:smoke` script to `package.json`.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS with the smoke spec green.

**Step 5: Commit**

```bash
git add playwright.config.js tests/score-scroll-smoke.spec.js package.json
git commit -m "test: add smoke coverage for score scroll"
```

### Task 2: Extract and normalize CSS

**Files:**
- Create: `styles/main.css`
- Create: `styles/tokens.css`
- Create: `styles/base.css`
- Create: `styles/layout.css`
- Create: `styles/controls.css`
- Create: `styles/stage.css`
- Create: `styles/modal.css`
- Modify: `index 优化版.html`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Extend the smoke test to assert that:

- the hero title is visible
- the viewport has a non-zero client size
- the export modal remains hidden on initial load

This should fail before CSS extraction if the selectors or visibility expectations are not yet asserted in the test.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: FAIL on the new assertions until the test is correctly updated.

**Step 3: Write minimal implementation**

- Move all inline `<style>` content into CSS files grouped by concern.
- Replace repeated inline styling in HTML with named classes where practical.
- Keep the rendered layout visually equivalent.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS with the page still rendering correctly.

**Step 5: Commit**

```bash
git add styles index\ 优化版.html tests/score-scroll-smoke.spec.js
git commit -m "refactor: extract score scroll styles"
```

### Task 3: Extract app shell, constants, state, DOM cache, and static data

**Files:**
- Create: `scripts/app.js`
- Create: `scripts/core/constants.js`
- Create: `scripts/core/state.js`
- Create: `scripts/core/dom.js`
- Create: `scripts/data/music-font-registry.js`
- Modify: `index 优化版.html`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Extend the smoke test to assert that the page finishes loading without uncaught page errors:

- capture `pageerror` and failed requests
- expect both counts to stay at zero during initial page load

This should fail while the module shell is only partially extracted.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: FAIL due to missing module references or page errors while extraction is incomplete.

**Step 3: Write minimal implementation**

- Replace the inline script with a module entrypoint.
- Move shared constants, regexes, initial state, and DOM queries out of the HTML.
- Move `MusicFontRegistry` to a standalone data module.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS with no initial page errors.

**Step 5: Commit**

```bash
git add scripts index\ 优化版.html tests/score-scroll-smoke.spec.js
git commit -m "refactor: extract score scroll app shell"
```

### Task 4: Split rendering, SVG, MIDI, and playback logic into feature modules

**Files:**
- Create: `scripts/features/svg-loader.js`
- Create: `scripts/features/render-queue.js`
- Create: `scripts/features/renderer.js`
- Create: `scripts/features/midi.js`
- Create: `scripts/features/playback.js`
- Create: `scripts/utils/format.js`
- Create: `scripts/utils/math.js`
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Extend the smoke test to interact with the static UI safely:

- verify the play button starts disabled on first load
- verify the progress slider starts disabled
- verify zoom controls exist and the zoom label shows `100%`

This should fail if refactor work breaks initial transport UI state.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: FAIL until the test reflects the initial state or the extraction stabilizes.

**Step 3: Write minimal implementation**

- Move rendering, geometry, MIDI timeline, playback math, and formatting helpers into focused modules.
- Keep public APIs small and wire them through `app.js`.
- Preserve initial transport UI state.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS with no regression in initial controls.

**Step 5: Commit**

```bash
git add scripts tests/score-scroll-smoke.spec.js
git commit -m "refactor: modularize render and playback logic"
```

### Task 5: Split audio, export, and UI event wiring, then remove redundant code

**Files:**
- Create: `scripts/features/audio.js`
- Create: `scripts/features/export-video.js`
- Create: `scripts/features/ui-events.js`
- Modify: `scripts/app.js`
- Modify: `index 优化版.html`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Extend the smoke test to verify:

- clicking `#exportVideoBtn` opens the export modal
- clicking the cancel button closes or starts closing the modal without page errors

This should fail until modal wiring is restored through the extracted event modules.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: FAIL while event wiring is incomplete.

**Step 3: Write minimal implementation**

- Move audio load/sync logic into `audio.js`.
- Move export workflow into `export-video.js`.
- Centralize all DOM event binding in `ui-events.js`.
- Remove stale DOM references and redundant duplicated logic discovered during extraction.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS with modal interaction working and no new load errors.

**Step 5: Commit**

```bash
git add scripts index\ 优化版.html tests/score-scroll-smoke.spec.js
git commit -m "refactor: extract audio export and ui wiring"
```

### Task 6: Run full verification and document runtime expectations

**Files:**
- Modify: `package.json`
- Optional Modify: `README.md`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

If any manual-start assumptions are undocumented, add a small documentation expectation in the smoke workflow and confirm there is a standard command path for local verification.

If documentation is already sufficient, skip adding a new automated assertion and proceed with full verification instead.

**Step 2: Run test to verify baseline**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS before final cleanup.

**Step 3: Write minimal implementation**

- Add or refine scripts such as `test:smoke`.
- Document that the optimized page should be served from a local static server.
- Keep documentation minimal and specific.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.

Also run:

- `python3 -m http.server 8000`
- open `http://127.0.0.1:8000/index%20优化版.html`
- manually verify SVG upload, MIDI upload, play/pause, seek, zoom, and export modal opening

**Step 5: Commit**

```bash
git add package.json README.md tests/score-scroll-smoke.spec.js
git commit -m "docs: document optimized score scroll runtime"
```
