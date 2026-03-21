# Accidental Notehead Priority Design

## Goal

Enforce one classification rule consistently:

> If an accidental candidate is close to a notehead, it must be classified as an accidental, not a key signature.

This priority must still hold at system starts, including later systems such as measure 5 if it begins a new system.

## Root Cause

Current classification has two layers:

1. `classifyAccidentalGroups()` gives note-adjacent candidates some priority.
2. `identifyAndHighlightAccidentals()` adds a flat-specific rescue pass.

That rescue pass only runs when:

- the candidate is already in `keySignatureIds`
- the candidate is a flat
- a previous `barline` anchor exists

So candidates near noteheads can still remain `highlight-keysig` when:

- they occur at a system start with no previous barline anchor
- they are not flats
- their notehead proximity is slightly beyond the stricter symbol-graph seed thresholds

## Recommended Approach

Add one unified post-classification notehead-priority override in `identifyAndHighlightAccidentals()`:

- examine every accidental candidate, not just flats
- use direct notehead proximity
- if a nearby notehead exists, force the candidate into `accidentalIds` and remove it from `keySignatureIds`
- do this without requiring a previous barline anchor

## Why This Approach

- Matches the product rule directly
- Fixes system-start cases without depending on anchor type
- Avoids broad changes to symbol-graph heuristics that could shift unrelated key-signature grouping behavior

## Rejected Alternatives

### Only allow `system-start` inside the existing flat rescue pass

Too narrow. It keeps the behavior split across flat vs non-flat and still leaves accidental priority implicit instead of explicit.

### Widen symbol-graph seed thresholds globally

Higher risk. That changes the shared grouping model used by many accidental/key-signature cases and is harder to bound safely.

## Testing

Add a minimal SVG regression with two independent systems where each system starts with:

- a leading flat candidate
- a nearby notehead
- no prior barline anchor inside that system

Expected:

- both flats end as `highlight-accidental`
- neither remains `highlight-keysig`
