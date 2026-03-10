# Playback Tail Buffer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend score playback with a fixed 2-second tail so audio fades out and visual scrolling finishes naturally after the final mapped event.

**Architecture:** Keep the raw timeline unchanged and layer a fixed playback tail on top of it. `scripts/features/playback.js` owns the tail duration, x-position extrapolation, and tail fade gain, while `scripts/app.js` and `scripts/features/export-video.js` consume those helpers for live playback, progress UI, replay state, and exported audio fade-out.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests, static HTML app

---

### Task 1: Add regression tests for playback tail behavior

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

- Add a module-level test that imports `scripts/features/playback.js`.
- Assert the helper exposes a 2-second tail constant.
- Assert `getInterpolatedXByTime()` keeps moving past the last raw map point during the tail and only reports `atEnd` at the extended duration.
- Assert the helper exposes a tail gain function that linearly fades from `1` to `0` across the tail window.
- Add a source-level assertion that `scripts/app.js` ends playback using `getTotalDuration()`, not the raw final map time.
- Add a source-level assertion that export audio uses a gain node with fade automation.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "extends playback with a two-second tail buffer"`

Expected: FAIL because playback helpers do not extrapolate in the tail and/or `app.js` still stops at the raw final map time.

**Step 3: Write minimal implementation**

- Add a tail buffer constant to `scripts/features/playback.js`.
- Extend helper interpolation, end detection, and tail gain calculation into the tail window.
- Update `scripts/app.js` to stop playback at the extended total duration, apply live audio fade-out, and use the extrapolated tail position at finish.
- Update `scripts/features/export-video.js` to apply the same tail fade envelope to offline-rendered export audio.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "extends playback with a two-second tail buffer"`

Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-11-playback-tail-buffer-design.md docs/plans/2026-03-11-playback-tail-buffer.md tests/score-scroll-smoke.spec.js scripts/features/playback.js scripts/app.js scripts/features/export-video.js
git commit -m "feat: add playback tail buffer"
```

### Task 2: Verify full smoke coverage

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS with no playback or export regressions.

**Step 2: Review diff**

Run: `git diff -- tests/score-scroll-smoke.spec.js scripts/features/playback.js scripts/app.js`

Expected: Only tail-buffer-related logic and test coverage changes.

**Step 3: Commit**

```bash
git add tests/score-scroll-smoke.spec.js scripts/features/playback.js scripts/app.js
git commit -m "test: cover playback tail buffer"
```
