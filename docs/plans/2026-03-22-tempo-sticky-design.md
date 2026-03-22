# Tempo Sticky Design

**Decision:** Add a new `tempo` sticky type that reuses the rehearsal-mark vertical pinning model while introducing a tempo-specific horizontal anchor rule: pin to the right of the active rehearsal mark when one exists in the lane, otherwise pin in the rehearsal-mark column above the opening clef.

**Problem:** The current sticky pipeline can pin rehearsal marks, clefs, key signatures, time signatures, braces, and instrument labels, but tempo indications stay in score flow. Real scores include both editable tempo words such as `Largo`, `rit.`, and `a tempo`, and metronome-mark groups such as a music glyph plus `= 56`. Those elements need to pin together without forcing hard-coded score-specific geometry.

**Scope:** This change covers top-of-system tempo indications that belong in the same opening region as rehearsal marks. It does not add MIDI or timeline semantics, and it does not attempt to infer tempo from arbitrary free text outside the configured whitelist and metronome-mark pattern.

## Goals

- Let users maintain a configurable whitelist of tempo text strings.
- Detect metronome-mark groups using stable SVG structure instead of score-specific coordinates.
- Keep tempo text-only marks and metronome-mark groups in one sticky category.
- Pin tempo marks beside rehearsal marks when both are active in the same lane.
- Fall back to the rehearsal-mark anchor column when no rehearsal mark is active.

## Non-Goals

- Parsing tempo values into playback tempo maps.
- Recognizing every possible expressive text marking automatically.
- Creating a shared sticky group between rehearsal and tempo items. The relationship only affects horizontal positioning.

## Options Considered

### Option 1: Text whitelist only

Simple to maintain, but misses metronome marks like `♪ = 56` or only captures the numeric suffix.

### Option 2: Geometry-only tempo detection

Could detect more layout variants, but would be brittle across fonts and score exporters.

### Option 3: Hybrid detection

Use a whitelist for textual tempo terms and a structural rule for metronome marks. This is the chosen option because it keeps user-editable text recognition while giving metronome marks a stable detection path.

## Detection Design

### Tempo Text Whitelist

`scripts/app.js` will define a `TEMPO_TEXT_WHITELIST` array. Matching will normalize text by trimming, collapsing whitespace, and lowercasing, so users can add canonical forms such as `a tempo`, `rit.`, or `largo` without caring about SVG spacing differences.

Whitelist hits become `.highlight-tempomark` candidates unless they are already claimed by higher-priority classes such as time signatures, rehearsal marks, or instrument labels.

### Metronome-Mark Detection

A metronome-mark group is recognized when all of the following are true:

- one text node uses a music-text font such as `Bravura Text`,
- that node contains a single private-use music glyph,
- a sibling or near-neighbor text node matches a tempo-number pattern such as `= 56`, `=132`, or `≈ 48`,
- the two nodes share nearly the same baseline and sit close together horizontally,
- the combined group sits in the same upper opening region used by tempo and rehearsal markings rather than inside the staff body.

The primary path will prefer nodes inside the same parent `<g>`, because the sample SVG uses one group for the glyph and number. A geometry-based fallback will still allow close neighbors from adjacent nodes if needed.

Both the glyph text and the numeric text will receive `.highlight-tempomark` so they stay in the same sticky block.

## Sticky Integration

### Symbol Type

`svg-analysis.js` will map `.highlight-tempomark` to `TempoMark`, then to a new sticky lane type `tempo`.

### Lane Assignment

Tempo items will follow the same lane-assignment rules as rehearsal marks. This keeps top-of-staff tempo content attached to the opening clef lane even when the text drifts vertically.

### Blocking and Replacement

Tempo blocks will cluster by existing sticky block rules. Later tempo blocks replace earlier ones once their lock distance is reached, just like rehearsal marks.

## Pinning Behavior

### Vertical Position

Tempo uses the rehearsal-mark vertical baseline logic:

- above the opening clef for regular upper lanes,
- below the opening envelope for bottom lanes if that lane logic is already active.

This keeps tempo and rehearsal aligned on the same vertical rail without inventing a second baseline system.

### Horizontal Position

Tempo introduces a new horizontal helper:

- if the lane has an active rehearsal block, the active tempo block gets an extra X offset equal to the active rehearsal display width plus a small padding constant,
- if no rehearsal block is active, the tempo block gets no extra X and therefore occupies the rehearsal-mark column,
- replaced tempo blocks freeze their current X just like other animated sticky properties, while future tempo blocks remain at origin until activation.

This avoids changing the actual lock timing while still letting tempo sit to the right of rehearsal marks during the pinned phase.

## Testing Strategy

- Add helper-level tests for tempo horizontal anchoring in `tests/sticky-layout.spec.js`.
- Add smoke tests for text whitelist detection, metronome-mark detection, and tempo lane/block metadata in `tests/score-scroll-smoke.spec.js`.
- Add a rendering regression that verifies tempo pins to the right of rehearsal marks when both are active.
- Add a rendering regression that verifies tempo falls back to the rehearsal column when no rehearsal mark exists.

## Risks and Mitigations

- False positives from instrument labels containing music glyphs.
  Mitigation: require the tempo-number pattern and reject known instrument/rehearsal/time-signature classes before tempo tagging.
- Missing tempo words because the whitelist is incomplete.
  Mitigation: keep the whitelist local and easy to extend.
- Overlapping pinned symbols if the spacing constant is too small.
  Mitigation: centralize the padding constant and cover the right-of-rehearsal case with a smoke test.
