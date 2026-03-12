# SVG Local Text Font Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load imported SVG text fonts from the local machine so canvas-rendered terms like `let ring` and tempo marks preserve their intended typeface.

**Architecture:** Keep SVG text extraction and canvas drawing unchanged, but add a dedicated feature module that discovers imported text font families, injects `@font-face` rules backed by `src: local(...)`, and requests those fonts through the browser Font Loading API before the first import render. `scripts/app.js` remains the orchestration point; the new module owns normalization, filtering, CSS injection, and load attempts.

**Tech Stack:** ES modules, browser Font Loading API, Playwright smoke tests

---

### Task 1: Lock The Font Injection Regressions

**Files:**
- Create: `tests/fixtures/local-text-font-loading.svg`
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add:
- a fixture containing SVG text that uses `font-family="Ounen-mouhitsu"`,
- a smoke test that uploads the fixture and asserts the page injects a `.svg-local-font-face` style block containing `local("Ounen-mouhitsu")`,
- a smoke test that monkeypatches `document.fonts.load`, uploads the fixture, and asserts the app attempts to load `Ounen-mouhitsu`.

**Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "injects local font-face rules for imported SVG text fonts|requests local imported text fonts through the Font Loading API"`

Expected: FAIL because the app does not yet inject local font-face rules or call `document.fonts.load()` for imported SVG text families.

### Task 2: Implement Local SVG Text Font Loading

**Files:**
- Create: `scripts/features/svg-text-fonts.js`
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Create `scripts/features/svg-text-fonts.js` with helpers that:
- collect unique font families from imported `text`/`tspan` nodes,
- normalize and filter those family names,
- inject `.svg-local-font-face` `@font-face` rules that use `local(...)`,
- call `document.fonts.load()` for the filtered families and return a settled promise.

Update `scripts/app.js` to:
- import the new helper,
- clear old `.svg-local-font-face` styles before each import,
- invoke the helper after extracted SVG styles are mounted and before first-render waiting logic runs,
- keep missing-font failures non-fatal and log attempted families with `debugLog`.

**Step 2: Run tests to verify they pass**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "injects local font-face rules for imported SVG text fonts|requests local imported text fonts through the Font Loading API"`

Expected: PASS

### Task 3: Verify The Import Pipeline Still Behaves

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run targeted regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "injects local font-face rules for imported SVG text fonts|requests local imported text fonts through the Font Loading API|recognizes Wu Zetian opening percussion clefs and fragmented opening time signatures|does not treat tablature fingering digits as time signatures in Shounen no Yume"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-12-svg-local-text-font-loading-design.md docs/plans/2026-03-12-svg-local-text-font-loading.md tests/fixtures/local-text-font-loading.svg tests/score-scroll-smoke.spec.js scripts/features/svg-text-fonts.js scripts/app.js
git commit -m "feat: load imported SVG text fonts locally"
```
