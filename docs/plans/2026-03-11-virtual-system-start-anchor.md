# Virtual System Start Anchor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Use the left staff edge as a virtual system start anchor whenever a system has no physical opening barline, without faking a highlighted barline element.

**Architecture:** Extend the initial barline detector so it distinguishes physical start barlines from virtual system-start anchors. Feed the virtual anchor into the existing downstream coordinate chain while preserving later physical barlines and existing behavior for systems that do have a real opening line.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests, SVG DOM geometry.

---

### Task 1: Add a failing regression for no-opening-barline systems

**Files:**
- Create: `tests/fixtures/no-opening-barline-single-staff.svg`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke test that imports a fixture derived from the Dorico single-staff example and asserts:

- the left staff edge is the exported start anchor
- no element at the first later physical barline is tagged as `highlight-barline` because of the fallback
- the start anchor sits left of the first true physical barline

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "uses the left staff edge as a virtual start anchor when no physical opening barline exists"`

Expected: FAIL on the current code because the fallback start anchor is not the left staff edge.

**Step 3: Keep the fixture small**

Copy only the opening area and enough later vertical lines to preserve the structural pattern.

### Task 2: Track physical vs virtual opening anchors

**Files:**
- Modify: `scripts/app.js`
- Modify: `types/globals.d.ts`

**Step 1: Add explicit state**

Add a new global flag:

- `window.hasPhysicalStartBarline`

Initialize it alongside the other global start-anchor state.

**Step 2: Run targeted test**

Run the same targeted Playwright command.

Expected: still FAIL, but the new state scaffolding is in place.

### Task 3: Implement virtual-start fallback in initial barline detection

**Files:**
- Modify: `scripts/app.js`

**Step 1: Measure staff geometry**

Inside `identifyAndHighlightInitialBarlines()`:

- compute the left staff edge
- derive staff space from the horizontal staff lines
- compare the leftmost valid vertical cluster against the left staff edge using a staff-space-scaled threshold

**Step 2: Distinguish physical vs virtual starts**

- If a real opening cluster exists near the system start, keep current behavior and set `hasPhysicalStartBarline = true`.
- Otherwise, set the start anchor to the left staff edge and set `hasPhysicalStartBarline = false`.
- Do not add `highlight-barline` to later physical barlines just because they are the leftmost visible verticals.

**Step 3: Run targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "uses the left staff edge as a virtual start anchor when no physical opening barline exists"`

Expected: PASS.

### Task 4: Keep downstream mapping consistent with virtual starts

**Files:**
- Modify: `scripts/app.js`
- Modify: `scripts/features/audio.js`

**Step 1: Verify downstream consumers**

Check any code that assumes the start anchor is also a physical barline.

Only adjust code if the new targeted regression reveals a dependence on a physical opening barline.

**Step 2: Add the smallest necessary fix**

Preserve the already-correct use of `globalAbsoluteSystemInternalX` and make sure any new physical/virtual distinction does not regress mapping or audio alignment.

**Step 3: Run nearby regressions**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js -g "uses the left staff edge as a virtual start anchor when no physical opening barline exists|preserves opening barlines, instrument names, and key signatures for transformed Opus SVG imports|classifies MuseScore opening semantic classes before signature guessing"
```

Expected: PASS.

### Task 5: Run verification

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run full Playwright suite**

Run: `npx playwright test`

Expected: PASS.
