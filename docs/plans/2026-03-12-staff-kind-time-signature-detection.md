# Staff-Kind Time Signature Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Classify staff bands by notation kind so percussion meters of any line count and tablature opening meters are detected without confusing tablature fingering digits for time signatures.

**Architecture:** Keep the existing time-signature candidate scanners, but replace the five-line eligibility gate with a richer staff-band model that includes `staffKind`. Time-signature acceptance will depend on staff kind, anchor position, stacked-number legality, and whether the candidate appears before the first relevant event in that band.

**Tech Stack:** ES modules, Playwright smoke tests, SVG DOM geometry

---

### Task 1: Lock The Regressions

**Files:**
- Create: `tests/fixtures/tablature-opening-meter.svg`
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add:
- a tablature fixture whose opening `4/4` should be recognized while later `0/2/4` fingering digits remain unclassified,
- a smoke test for the provided `遗失的钻戒` score that asserts the percussion meter is recognized on the percussion band,
- a source-level regression that ensures time-signature staff-band eligibility no longer depends solely on `lineYs.length === 5`.

**Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes opening tablature time signatures before fingering digits|recognizes percussion time signatures for non-five-line staves|uses staff-kind-aware eligibility for time-signature bands"`

Expected: FAIL because the current detector still rejects non-five-line bands outright.

### Task 2: Implement Staff-Kind-Aware Band Classification

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Update `scripts/app.js` to:
- enrich `buildTimeSignatureStaffBandsFromLineYs()` output with `staffKind`,
- infer `staffKind` using line count, clef identity, nearby instrument names, and tablature/percussion heuristics,
- replace `isEligibleTimeSignatureStaffBand()` with staff-kind-aware eligibility rather than a five-line-only rule.

**Step 2: Run focused tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "uses staff-kind-aware eligibility for time-signature bands"`

Expected: PASS

### Task 3: Gate Candidate Acceptance By Staff Kind And First Event

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Update the time-signature candidate review path to:
- keep the existing stacked-number requirement,
- allow `standard`, `percussion`, and opening `tablature` bands through vertical band checks,
- reject candidate digits that appear after the first relevant event for the band,
- treat tablature fingering digits as the first event so in-measure tab numbers do not become meters.

**Step 2: Run focused tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes opening tablature time signatures before fingering digits|recognizes percussion time signatures for non-five-line staves"`

Expected: PASS

### Task 4: Verify Nearby Regressions

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run targeted regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes opening tablature time signatures before fingering digits|recognizes percussion time signatures for non-five-line staves|does not treat tablature fingering digits as time signatures in Shounen no Yume|recognizes Wu Zetian opening percussion clefs and fragmented opening time signatures"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-12-staff-kind-time-signature-detection-design.md docs/plans/2026-03-12-staff-kind-time-signature-detection.md tests/fixtures/tablature-opening-meter.svg tests/score-scroll-smoke.spec.js scripts/app.js
git commit -m "fix: distinguish tablature and percussion time signatures"
```
