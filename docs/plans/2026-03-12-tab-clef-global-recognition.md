# Tab Clef Global Recognition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register TAB clef signatures for the supplied fonts and make clef and accidental recognition fall back across all registered music fonts.

**Architecture:** Keep the current selected-font lookup as the first match source, but add shared all-font maps for categories that need mixed-font resilience. The registry change is purely data-driven, while runtime changes stay local to the signature compilation and symbol-identification helpers in `scripts/app.js`.

**Tech Stack:** ES modules, Playwright smoke tests, SVG signature dictionaries

---

### Task 1: Lock The TAB Registry And Global Fallback Regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing tests**

Add:
- A static registry regression that reads `scripts/data/music-font-registry.js` through `vm` and asserts the exact `Tab Clef (TAB谱号)` signature sets for the 12 supplied fonts.
- A lightweight behavior regression that loads `scripts/app.js` as source and asserts the runtime now contains shared global clef and accidental fallback maps instead of a Bravura-only clef fallback.

**Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "registers dedicated TAB clef signatures for the provided desktop fonts|uses all-font fallback maps for clef and accidental recognition"`

Expected: FAIL because the registry does not yet include `Tab Clef (TAB谱号)` and the runtime still uses the old fallback logic.

### Task 2: Add TAB Clef Registry Data And Shared Fallback Maps

**Files:**
- Modify: `scripts/data/music-font-registry.js`
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the minimal implementation**

Update `scripts/data/music-font-registry.js`:
- Add `Tab Clef (TAB谱号)` to each of the 12 target font `clefs` objects.
- Store the supplied TAB fingerprints after removing duplicates within each font.

Update `scripts/app.js`:
- Add global compiled maps for `clefs` and `accidentals`, similar to the existing `allKnownNoteheadMap`.
- Populate them during startup.
- Change `identifyClefOrBrace()` to try `activeSignatureMap.clefs[sig]` first and the shared all-font clef map second.
- Change `identifyAccidental()` to try `activeSignatureMap.accidentals[sig]` first and the shared all-font accidental map second.
- Preserve the existing percussion-clef slash guard after lookup.

**Step 2: Run tests to verify they pass**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "registers dedicated TAB clef signatures for the provided desktop fonts|uses all-font fallback maps for clef and accidental recognition"`

Expected: PASS

### Task 3: Verify Nearby Symbol-Recognition Regressions

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run targeted regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "registers dedicated TAB clef signatures for the provided desktop fonts|uses all-font fallback maps for clef and accidental recognition|registers dedicated double-whole notehead signatures for the provided round fonts|recognizes Wu Zetian opening percussion clefs and fragmented opening time signatures|does not treat tablature fingering digits as time signatures in Shounen no Yume"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-12-tab-clef-global-recognition-design.md docs/plans/2026-03-12-tab-clef-global-recognition.md tests/score-scroll-smoke.spec.js scripts/data/music-font-registry.js scripts/app.js
git commit -m "feat: add global tab clef recognition"
```
