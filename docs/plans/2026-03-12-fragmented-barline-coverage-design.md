# Fragmented Barline Coverage Design

## Problem

Some Dorico exports split a single logical barline into multiple vertical fragments on the same `x`. The current `TrueBarline` promotion in `scripts/app.js` only accepts clusters that align to the full system bounds or to one staff's exact `top/bottom`. Multi-fragment clusters therefore fail promotion even when they clearly cover valid adjacent staff ranges.

The `01 - Scroll - 登山 - 001.svg` import is the concrete failure:

- opening start line is recognized
- later barlines exist as repeated same-`x` fragments
- `BARLINES` stays at `1`, `MEASURES` stays at `0`

## Chosen Approach

Keep the existing strict checks first, then add one fallback:

1. Preserve the current start-line path and exact single-staff / full-system alignment checks.
2. If those checks fail, inspect the cluster's individual vertical segments.
3. Treat a cluster as a true barline when its fragments collectively align to contiguous staff ranges on the same `x`.

This is narrower than “just increase tolerance”, so it should not weaken stem filtering or accidental protection.

## Detection Rule

- Build contiguous staff ranges from the already-derived `staves` array.
- For each segment in a cluster, try to match its `top/bottom` against any contiguous staff range using a slightly more forgiving boundary tolerance than the current exact check.
- Union the covered staff indices across all matched segments.
- Promote the cluster when:
  - exact alignment already passed, or
  - the fallback covers multiple staff slots across the system.

## Non-Goals

- No changes to opening start-anchor detection
- No changes to stem filtering
- No changes to TAB/percussion time-signature logic in this pass

## Validation

- Add a smoke regression for `01 - Scroll - 登山 - 001.svg` asserting non-zero mapped barlines/measures.
- Re-run the existing TAB/percussion time-signature smoke tests to confirm no regression.
