# Unused Code Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove only code and config entries that are provably unused in the current Score Scroll app.

**Architecture:** Keep the current static-site and ES module structure unchanged. Limit changes to dead imports, dead state fields, dead helper exports, and one invalid package field so runtime behavior stays identical.

**Tech Stack:** Static HTML, native ES modules, Playwright smoke tests, npm metadata

---

### Task 1: Lock the cleanup scope with a failing test

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a source-inspection test that asserts:
- `package.json` has no `main`
- `scripts/app.js` does not reference `encodedChunks`, `isExportingVideo`, `videoEncoder`, or `createPlaybackState`
- `scripts/core/state.js` does not define `encodedChunks`, `isExportingVideo`, or `videoEncoder`
- `scripts/features/playback.js` does not define or export `createPlaybackState`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "removes only the currently unused code paths and config fields"`
Expected: FAIL because those unused items still exist.

### Task 2: Remove dead runtime references

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/core/state.js`
- Modify: `scripts/features/playback.js`

**Step 1: Write minimal implementation**

Remove:
- dead destructured state fields in `scripts/app.js`
- dead `createPlaybackState` import and returned export in `scripts/features/playback.js`
- dead initial state fields in `scripts/core/state.js`

Do not change any active playback, rendering, or export behavior.

**Step 2: Run targeted test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "removes only the currently unused code paths and config fields"`
Expected: PASS

### Task 3: Remove stale package metadata

**Files:**
- Modify: `package.json`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write minimal implementation**

Delete the `main` field that points to a nonexistent `index.js`.

**Step 2: Run full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`
Expected: PASS
