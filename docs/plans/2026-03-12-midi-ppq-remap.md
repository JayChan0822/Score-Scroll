# MIDI PPQ Remap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild SVG tick mapping with the real MIDI PPQ whenever MIDI is imported after SVG.

**Architecture:** Keep MIDI parsing unchanged and centralize PPQ-dependent score mapping behind one app-level helper. Both import orders should use the same helper so `svgTags.tick` is always derived from the active PPQ before tempo fusion runs.

**Tech Stack:** JavaScript app module, Playwright smoke tests

---

### Task 1: Write the regression for SVG-first MIDI remapping

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a Playwright regression that:

- builds a minimal two-bar SVG in-memory
- builds a minimal PPQ-960 MIDI in-memory with a tempo change after the first bar
- compares `SVG -> MIDI` against `MIDI -> SVG`
- asserts both orders end with `8.00` in `#exportEndInput`

**Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js --grep "rebuilds score ticks with the imported midi ppq even when svg is loaded first"
```

Expected: FAIL because SVG-first import still uses stale `480`-based ticks.

### Task 2: Rebuild score mapping after MIDI import

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/app.js`

**Step 1: Write the minimal implementation**

- extract a helper that reruns `initScoreMapping()` against the currently loaded SVG root
- use that helper in the SVG import path
- use that helper in the MIDI import path before `timelineFeature.recalculateMidiTempoMap()`

**Step 2: Run regression to verify it passes**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js --grep "rebuilds score ticks with the imported midi ppq even when svg is loaded first"
```

Expected: PASS

### Task 3: Verify no nearby tempo-mapping regressions

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js` only if stabilization is needed

**Step 1: Run targeted verification**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js --grep "rebuilds score ticks with the imported midi ppq even when svg is loaded first|extracts the timeline pipeline into a dedicated feature module|recognizes opening tablature time signatures before fingering digits|recognizes fragmented multi-group barlines in Dengshan imports"
```

Expected: PASS
