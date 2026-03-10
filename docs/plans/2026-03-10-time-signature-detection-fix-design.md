# Time Signature Detection Fix Design

## Goal

Fix three linked SVG recognition bugs in score import:

- opening stacked time signatures at the system start should be detected
- short stems near the left edge should not be misclassified as opening barlines
- isolated Sebastian time-signature glyphs later in the staff should not be detected as valid time signatures

## Observed Root Cause

The current bugs come from two coupled heuristics in `scripts/app.js`.

`identifyAndHighlightInitialBarlines()` currently admits any vertical line with height `>= 8` into the left-edge start cluster. In the failing SVG, the first short `V.P.` stem is close enough in X to the real opening barline cluster that it is accepted as part of that cluster and then selected as the effective system start.

Once that happens, `globalSystemBarlineScreenX` is pushed to the right of the actual opening `4/4`, so `identifyAndHighlightTimeSignatures()` rejects the real opening time signature as if it were left of the system start.

Separately, time-signature candidate pairing is only applied to plain ASCII digits. Sebastian private-use glyphs such as `` and `` are treated as standard time-signature glyphs, so isolated single glyphs can slip through. The function also computes `isNearBarline` but never rejects candidates when that value stays false.

## Recommended Approach

Apply the smallest behavior change that closes the three failure modes without redesigning the entire scanner.

1. Tighten opening-barline clustering so obviously short stems do not survive when much taller left-edge verticals exist in the same cluster.
2. Move stacked-partner validation into a shared helper that works for both ASCII time-signature digits and Sebastian private-use time-signature glyphs.
3. Restore the missing `isNearBarline` rejection branch so late isolated glyphs cannot be highlighted just because they made it into the candidate set.

This keeps the current architecture intact and only adjusts the faulty heuristics.

## Detection Rules

### Opening barlines

- Keep collecting left-edge vertical segments as today.
- After building the left-edge cluster, compare candidate heights inside that cluster.
- If the cluster contains much taller verticals, discard short outliers before picking the effective opening barline and applying `highlight-barline`.

This preserves true multi-staff opening barlines while excluding local note stems.

### Time-signature pairing

- Treat plain numeric text and Sebastian time-signature glyphs as requiring a vertically stacked partner.
- Define pairing by close X alignment and clear Y separation within a bounded range.
- Continue allowing giant Sibelius time signatures through the existing giant-text path.

This lets stacked opening `4/4` survive while rejecting isolated single ``.

### Near-start validation

- Keep the existing physical barline and fallback staff-start checks.
- If neither passes, reject the candidate instead of always highlighting it.

## Test Strategy

Add a targeted regression fixture that reproduces the three conditions in a controlled SVG:

- a real opening barline
- a nearby short stem that must not become the effective opening barline
- a stacked opening `4/4` using Sebastian glyphs that must be highlighted
- a later isolated single `` that must not be highlighted

The regression should fail against the current code before implementation, then pass after the heuristic fixes. Existing smoke and typecheck still need to stay green.
