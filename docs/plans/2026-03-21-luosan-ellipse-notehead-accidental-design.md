# Luosan Ellipse Notehead Accidental Design

## Goal

Fix accidental reclassification so flats near noteheads still become accidentals when the nearby noteheads are drawn as `ellipse` or `circle`, including noteheads that sit slightly away from the five-line staff.

## Root Cause

The accidental pipeline in `scripts/app.js` marks flats as provisional key-signature candidates first, then reclassifies some of them to accidentals if a nearby notehead is found.

That second-stage notehead collection currently only scans:

- `path`
- `text`
- `tspan`

It does not collect geometric noteheads drawn as:

- `ellipse`
- `circle`

As a result, scores like `luosan.svg` can leave a flat as `highlight-keysig` even though a nearby visual notehead exists.

## Recommended Approach

Keep the fix scoped to accidental reclassification:

1. add a dedicated accidental-notehead collector for `ellipse` and `circle`
2. apply a notehead-specific band fallback so slightly off-staff noteheads are still retained for proximity matching
3. pass all collected accidental noteheads into `classifyAccidentalGroups()` instead of dropping those with `bandIndex === -1`

This preserves the existing source-type gating for path/text noteheads while extending the collector to cover common geometric notehead exports.

## Why This Scope

- Directly fixes the misclassification path the user hit
- Avoids broad changes to unrelated notehead consumers
- Lets `symbol-graph` keep using its existing fallback-Y matching when one side has no confident band index

## Testing

Add a smoke test with a minimal SVG that has:

- a mid-system flat candidate
- a nearby hollow notehead drawn as `ellipse`
- the notehead slightly away from the staff lines

Expected result:

- the flat ends as `highlight-accidental`
- it does not remain `highlight-keysig`
