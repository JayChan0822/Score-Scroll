# Opening Giant Time Signature Design

## Goal

Recognize visually large opening numeric time signatures in single-line SVG scores so they enter the `highlight-timesig` path, become the first sticky `TimeSig` block, and keep the sticky staff bridge anchored to the real staff left edge.

## Root Cause

The current opening time-signature classifier decides whether a numeric candidate must have a stacked partner from `decoded.isGiant` alone.

That misses Dorico/Bravura opening `4/4` glyphs that are not giant because of their codepoint, but are visually rendered as giant symbols. In the affected single-line score:

- each `` glyph renders at about `104px` tall
- the vertical gap between the two glyphs is only about `15px`

`hasStackedTimeSignaturePartner()` computes its minimum valid stack gap from the element height, so these oversized opening glyphs fail the partner check and are rejected before highlighting.

Once the opening block is rejected, downstream sticky grouping treats a later meter change as the first `TimeSig` block.

Single-line systems without a physical opening barline also expose a second anchor mismatch: sticky pinning is based on `stickyMinX`, while the bridge staff lines are drawn from `globalAbsoluteSystemInternalX`. When these diverge, the pinned bridge can start from a different left edge than the original staff.

## Options

1. Promote visually large numeric candidates to giant before the stacked-partner check.
   Recommended. It fixes the actual classification mistake and works for both text and path candidates.

2. Loosen the stacked-partner gap formula globally.
   This would change behavior for all regular numeric time signatures and raises false-positive risk.

3. Add a Dorico or Bravura-specific special case.
   This would patch the current file set but would encode the wrong abstraction. The problem is geometric, not vendor-specific.

## Chosen Design

Add a visual giant classification step during candidate creation:

- compute `isVisuallyGiantTimeSig` from the candidate rect height
- treat the candidate as giant when either:
  - the decoder already marks it giant, or
  - the rendered height exceeds the giant threshold

Numeric candidates that are visually giant will skip the stacked-partner requirement, but they must still satisfy the existing staff-band and opening-anchor or barline proximity checks.

This keeps the stricter rules for regular small stacked digits while allowing oversized opening `4/4` glyphs to classify correctly.

For systems with `window.hasPhysicalStartBarline === false`, reuse `globalAbsoluteSystemInternalX` as the sticky left-edge anchor. That keeps the pinned bridge lines and the original staff left edge on the same reference point.

## Verification

- Add a regression proving the `Bravura` opening `4/4` in the single-line no-opening-barline fixture is highlighted.
- Add a regression proving the sticky left-edge anchor falls back to the virtual system start when there is no physical opening barline.
- Run targeted Playwright coverage.
- Run `npm run typecheck`.
- Run full `npx playwright test`.
