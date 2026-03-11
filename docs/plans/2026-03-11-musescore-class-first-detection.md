# MuseScore Class-First Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make MuseScore-exported SVGs prefer semantic `class` names for opening bracket, clef, key signature, and time signature detection while preserving the existing fallback chain.

**Architecture:** Add a small MuseScore-format helper in `scripts/app.js`, then thread class-first classification into the existing opening detectors. Keep all existing text/signature logic in place as fallback so non-MuseScore files continue to behave the same way.

**Tech Stack:** Vanilla JavaScript, Playwright smoke tests, SVG DOM classification.

---

### Task 1: Add a failing MuseScore regression test

**Files:**
- Create: `tests/fixtures/musescore-opening-classes.svg`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke test that imports the MuseScore fixture and asserts:

- The opening `path.Bracket` has `highlight-brace`.
- The opening `path.Clef` elements have `highlight-clef`.
- The opening `path.KeySig` elements have `highlight-keysig`.
- The opening `path.TimeSig` elements nearest the system start have `highlight-timesig`.

Use direct DOM queries against `path[class="..."]` so the test reflects the exported structure.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "classifies MuseScore opening semantic classes before signature guessing"`

Expected: FAIL because current code ignores `path.TimeSig` and `path.Bracket`, and the clef/key signature paths are not reliably recognized by the registry.

**Step 3: Keep the fixture minimal**

Create the fixture from the provided MuseScore SVG with the same opening structures and enough staff context for the existing spatial heuristics to run.

**Step 4: Re-run the targeted test**

Run the same Playwright command and confirm the failure is stable and caused by missing behavior rather than a bad fixture.

### Task 2: Add MuseScore format detection and class helpers

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write minimal helper API**

Add small helpers near the existing detection utilities:

- `isMuseScoreSvg(svgRoot)`
- `getSvgClassTokens(el)`
- `hasSvgClass(el, token)`

The MuseScore helper should check `desc` text and semantic class presence.

**Step 2: Wire helpers without changing behavior yet**

Use the helpers only where the new regression will need them; do not refactor unrelated detectors.

**Step 3: Run targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "classifies MuseScore opening semantic classes before signature guessing"`

Expected: still FAIL, but with the new helper plumbing in place.

### Task 3: Implement class-first opening clef and bracket detection

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Update clef detection**

In `identifyAndHighlightClefs()`:

- If the SVG is MuseScore, classify `path.Clef` directly as `highlight-clef`.
- Continue pushing those elements into the main clef anchor list.
- Preserve existing text/signature fallback.

**Step 2: Update bracket detection**

In `identifyAndHighlightGeometricBrackets()`:

- If the SVG is MuseScore and `path.Bracket` exists, mark it as `highlight-brace` and return early.
- Preserve existing geometric line/polyline bracket detection for all other cases.

**Step 3: Run targeted test**

Run the same targeted Playwright command.

Expected: test still FAILS on key signature or time signature assertions, but clef/bracket assertions should now pass.

### Task 4: Implement class-first opening key signature and time signature detection

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Update key signature detection**

In `identifyAndHighlightKeySignatures()`:

- If the SVG is MuseScore, mark `path.KeySig` as `highlight-keysig` before signature matching.
- Keep the current left-of-system guard.
- Preserve existing path/text fallback for everything else.

**Step 2: Update time signature detection**

In `identifyAndHighlightTimeSignatures()`:

- If the SVG is MuseScore, include `path.TimeSig` elements as candidates.
- Reuse existing spatial validation against staff bands and system-start/barline proximity.
- Preserve text-based candidate collection for non-MuseScore files and as fallback.

**Step 3: Run targeted test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js -g "classifies MuseScore opening semantic classes before signature guessing"`

Expected: PASS.

### Task 5: Verify broader regression surface

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run nearby smoke coverage**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js -g "preserves choir fixture piano opening key signatures|preserves green tea fixture piano opening key signatures|preserves italic font-style|classifies left-of-system verticals as bracket lines without relying on barline classes"
```

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Run full Playwright suite if targeted checks are green**

Run: `npx playwright test`

Expected: PASS.
