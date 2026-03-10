# JSDoc + `@ts-check` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add non-invasive static type checking to the five highest-value modules using JSDoc and `// @ts-check`.

**Architecture:** Keep the app as plain JavaScript and static HTML. Add a minimal TypeScript checker configuration with `allowJs`, `checkJs`, and `noEmit`, then annotate only the selected modules with local structural types.

**Tech Stack:** Static HTML, native ES modules, JSDoc, TypeScript checkJs mode, Playwright smoke tests

---

### Task 1: Add a failing typecheck scaffold test

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add one source-inspection test that asserts:

- `package.json` exposes `typecheck`
- `tsconfig.json` exists
- `tsconfig.json` enables `allowJs`, `checkJs`, and `noEmit`
- the five target files contain `// @ts-check`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds jsdoc-based typecheck coverage for the selected core modules"`

Expected: FAIL because the script/config/comments do not exist yet.

### Task 2: Add the checker configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write minimal implementation**

- Add `typescript` as a dev dependency
- Add `typecheck` script
- Create `tsconfig.json` limited to the five first-phase files

**Step 2: Run the failing test again**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "adds jsdoc-based typecheck coverage for the selected core modules"`

Expected: still FAIL until the files themselves are annotated.

### Task 3: Annotate core state and DOM modules

**Files:**
- Modify: `scripts/core/state.js`
- Modify: `scripts/core/dom.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write minimal implementation**

- Add `// @ts-check`
- Add JSDoc typedefs for the returned state shape
- Add JSDoc return typing for DOM references with specific element types

**Step 2: Run targeted checker**

Run: `npm run typecheck`

Expected: FAIL only on the remaining untyped feature modules.

### Task 4: Annotate playback, audio, and export feature modules

**Files:**
- Modify: `scripts/features/playback.js`
- Modify: `scripts/features/audio.js`
- Modify: `scripts/features/export-video.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write minimal implementation**

- Add `// @ts-check`
- Add JSDoc for options objects, helper return shapes, and callback signatures
- Add narrow compatibility casts only where browser/vendor APIs need them

**Step 2: Run checker to green**

Run: `npm run typecheck`

Expected: PASS

### Task 5: Re-run runtime verification

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run full verification**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS
