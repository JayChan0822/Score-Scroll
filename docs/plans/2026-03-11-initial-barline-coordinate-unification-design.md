# Initial Barline Coordinate Unification Design

## Goal

Fix SVG imports where the opening system anchor is misdetected because the initial barline heuristic compares mixed coordinate spaces. The repair must be generic, not tied to one fixture, and must restore correct classification of opening barlines, left-of-system instrument names, and opening key signatures.

## Observed Root Cause

The failure starts in `identifyAndHighlightInitialBarlines()` in `scripts/app.js`.

- Candidate opening verticals are collected in SVG-internal coordinates from raw `line` and `polyline` attributes.
- The leftmost clef anchor is computed from `getBBox()` and `getCTM()`.
- Those values are then compared directly to decide whether the leftmost vertical belongs to the opening cluster.

That comparison is not reliable for imported SVGs that express clefs as transformed text glyphs. In the failing Opus SVG, the leftmost vertical is the real opening barline, but the clef X collapses into a different scale, so the opening cluster is rejected. Once the start barline is lost:

- `globalSystemBarlineScreenX` falls back to the wrong position
- `identifyAndHighlightInstrumentNames()` no longer marks left-of-system text such as `Piano`
- `identifyAndHighlightKeySignatures()` seeds opening accidentals incorrectly, and `identifyAndHighlightAccidentals()` later promotes them to accidentals instead of preserving them as key signatures

## Recommended Approach

Repair the root cause by making the opening-barline decision in one coordinate space only.

Use screen-space geometry for the opening-barline heuristic because:

- the later instrument-name and key-signature filters already depend on screen-space `getBoundingClientRect()` comparisons
- screen-space works uniformly for transformed text glyphs, paths, and grouped geometry
- the fix can stay local to the start-barline detector while still writing back the existing internal coordinate state for downstream timeline and bracket logic

## Coordinate Strategy

### Opening-barline detection

- Keep collecting candidate opening verticals from the SVG DOM as today.
- For each candidate vertical, record both:
  - its SVG-internal X value, for `globalSystemInternalX`
  - its screen-space X value, from `getBoundingClientRect().left`, for opening-cluster comparisons
- Compute the leftmost clef anchor in screen space as well.
- Compare the leftmost vertical cluster against the leftmost clef using screen-space values only.

### State handoff

- Preserve `globalSystemBarlineScreenX` as a screen-space value.
- Preserve `globalSystemInternalX` as an SVG-internal value.
- When no explicit opening barline exists, derive the fallback start consistently from the same chosen anchor path instead of mixing screen and internal values implicitly.

This keeps bracket detection and score mapping behavior compatible while eliminating the mixed-space comparison that causes the regression.

## Scope Boundaries

This change should stay narrowly focused.

- Do modify `identifyAndHighlightInitialBarlines()`
- Do add a small helper if it reduces repeated geometry extraction
- Do add a regression that exercises the real Opus/text-clef scenario
- Do not redesign the later accidental contagion logic unless the opening-barline fix proves insufficient
- Do not special-case this file name or this exact glyph sequence

## Test Strategy

Add a focused Playwright regression to `tests/score-scroll-smoke.spec.js` that imports the real SVG fixture from the user-provided path and asserts:

- at least one opening vertical is marked with `highlight-barline`
- `Piano` is marked with `highlight-instname`
- the first opening `` remains `highlight-keysig`
- the first opening `` is not downgraded to `highlight-accidental`

The test should fail on the current implementation and pass after the coordinate unification change. Existing smoke tests and `npm run typecheck` must remain green.
