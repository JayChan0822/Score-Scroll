# Timeline Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the score timeline generation and reconstruction pipeline from `scripts/app.js` into a dedicated feature module without changing runtime behavior.

**Architecture:** Add a `scripts/features/timeline.js` factory that owns time-signature extraction and timeline rebuilding. `scripts/app.js` will keep orchestration points and inject only the state accessors, setters, and UI side effects the timeline feature needs.

**Tech Stack:** Vanilla ES modules, Playwright smoke tests, JSDoc `@ts-check`.

---

### Task 1: Add a failing regression for timeline module extraction

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**
Add a smoke assertion that expects `scripts/features/timeline.js` to exist and `scripts/app.js` to create/use the timeline feature.

**Step 2: Run test to verify it fails**
Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "extracts the timeline pipeline into a dedicated feature module"`
Expected: FAIL because the module does not exist yet.

**Step 3: Write minimal implementation**
Create the timeline module and wire it into `app.js`.

**Step 4: Run test to verify it passes**
Run the same grep command.
Expected: PASS.

### Task 2: Extract the timeline feature

**Files:**
- Create: `scripts/features/timeline.js`
- Modify: `scripts/app.js`

**Step 1: Move timeline helpers into the new module**
Extract `extractTimeSignatures`, `recalculateMidiTempoMap`, `generateManualTempoMap`, and `fuseDataWithTempoMap` into `createTimelineFeature(...)`.

**Step 2: Keep behavior stable with injected dependencies**
Pass only the needed getters, setters, and side-effect hooks from `app.js` into the module.

**Step 3: Apply low-risk cleanup**
Consolidate timeline default/fallback helpers and timeline reset behavior inside the new module.

**Step 4: Run focused verification**
Run: `npm run typecheck`
Expected: PASS.

### Task 3: Run regression coverage and smoke verification

**Files:**
- Verify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the targeted extraction test**
Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "extracts the timeline pipeline into a dedicated feature module"`
Expected: PASS.

**Step 2: Run the full smoke suite**
Run: `npx playwright test tests/score-scroll-smoke.spec.js`
Expected: PASS.
