# Debug Log Gating Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Silence development-only debug logs by default while preserving warning and error reporting.

**Architecture:** Add a shared `scripts/utils/debug.js` helper with a disabled-by-default gate, then migrate pure `console.log(...)` instrumentation in the selected files to `debugLog(...)`. Leave warnings and errors untouched so real failures still surface in the console.

**Tech Stack:** Vanilla ES modules, Playwright smoke tests, JSDoc `@ts-check`.

---

### Task 1: Add a failing regression for the shared debug logger

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a regression that requires:

- `scripts/utils/debug.js` to exist
- `DEBUG_LOGS_ENABLED = false`
- `debugLog(...args)` to guard `console.log(...)`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "gates debug instrumentation behind a shared debug logger"`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Create `scripts/utils/debug.js` with the disabled gate and wrapper.

**Step 4: Run test to verify it passes**

Run the same grep command.

Expected: PASS.

### Task 2: Migrate selected debug logs off direct console output

**Files:**
- Create: `scripts/utils/debug.js`
- Modify: `scripts/app.js`
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/features/timeline.js`
- Modify: `scripts/features/audio.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Extend the regression**

Require the selected files to import `debugLog` and stop using their current direct `console.log(...)` debug messages.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "routes selected development logs through the shared debug logger"`

Expected: FAIL because the files still use direct `console.log(...)`.

**Step 3: Write minimal implementation**

Import `debugLog` and replace only pure debug `console.log(...)` calls in:

- `scripts/app.js`
- `scripts/features/svg-analysis.js`
- `scripts/features/timeline.js`
- `scripts/features/audio.js`

Leave `console.warn(...)` and `console.error(...)` unchanged.

**Step 4: Run test to verify it passes**

Run the same grep command.

Expected: PASS.

### Task 3: Verify the gated logging change

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run the full smoke suite**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`

Expected: PASS.

**Step 3: Commit**

```bash
git add scripts/utils/debug.js scripts/app.js scripts/features/svg-analysis.js scripts/features/timeline.js scripts/features/audio.js tests/score-scroll-smoke.spec.js docs/plans/2026-03-10-debug-log-gating-design.md docs/plans/2026-03-10-debug-log-gating.md
git commit -m "chore: gate debug logs behind a shared helper"
```
