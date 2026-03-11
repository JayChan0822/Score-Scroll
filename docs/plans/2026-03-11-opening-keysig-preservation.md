# Opening Key Signature Preservation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve system-opening key signatures for transformed SVG imports so opening `Piano` flats do not get reclassified as accidentals.

**Architecture:** Keep the existing detection order, but make the accidental pass operate on a consistent screen-space staff model and explicitly protect the opening accidental run that lives between system start and the first notehead in each staff band. Do not alter the rest of the contagion rules.

**Tech Stack:** Plain JavaScript, Playwright smoke tests, browser DOM geometry APIs

---

### Task 1: Add regressions for the two failing SVG imports

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add assertions that:

- `Choir with piano.svg` keeps the two opening `Piano` flats as `highlight-keysig`
- `Green Tea Farm - Full score - 01 Flow 1.svg` keeps the opening `Piano` opening flats as `highlight-keysig`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "opening key signature"`

Expected: FAIL because the current code reclassifies those flats as `highlight-accidental`

**Step 3: Commit**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: cover opening key signature preservation"
```

### Task 2: Normalize the accidental pass to screen-space staff bands

**Files:**
- Modify: `scripts/app.js`

**Step 1: Implement minimal helper changes**

Update `identifyAndHighlightAccidentals()` so the staff-band inputs use the same screen-space coordinate system as noteheads and accidental candidates.

**Step 2: Run targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "opening key signature"`

Expected: still FAIL or partially fail until the opening-key guard is added

**Step 3: Commit**

```bash
git add scripts/app.js
git commit -m "refactor: align accidental band detection to screen space"
```

### Task 3: Protect opening key signatures before contagion

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write minimal implementation**

Before contagion, identify the opening accidental run per staff band:

- start from system start
- stop at the first notehead in that band
- keep only the leading consecutive accidentals in that window
- exclude those candidates from `propagateAccidentalContagion()`

**Step 2: Run targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "opening key signature"`

Expected: PASS

**Step 3: Commit**

```bash
git add scripts/app.js
git commit -m "fix: preserve opening key signatures"
```

### Task 4: Verify no regressions

**Files:**
- Modify: `types/globals.d.ts` only if type coverage needs small support updates

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 2: Run full smoke suite**

Run: `npx playwright test`

Expected: PASS

**Step 3: Commit**

```bash
git add scripts/app.js tests/score-scroll-smoke.spec.js types/globals.d.ts
git commit -m "test: verify opening key signature preservation"
```
