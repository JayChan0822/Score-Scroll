# Virtual System Start Anchor Design

## Context

Some SVG exports intentionally omit a physical opening barline. A representative case is the Dorico single-staff file:

- [01 - Full score - 长城谣 - 001.svg](/Users/jaychan/Library/Mobile%20Documents/com~apple~CloudDocs/__Work_Projects__/__Dorico%20Projects__/20251227_%E9%95%BF%E5%9F%8E%E8%B0%A3/Scores/01%20-%20Full%20score%20-%20%E9%95%BF%E5%9F%8E%E8%B0%A3%20-%20001.svg)

In that file:

- The left staff edge is around `x=106.917`.
- The first valid vertical line is around `x=235.918`.

That gap is too large to treat the first vertical line as an opening barline. The current fallback logic can still drift because it uses clef-based anchoring when no physical start barline is found.

## Goal

For every system that has no physical opening barline, anchor downstream mapping to the left staff edge as a virtual system start.

## Key Decision

Use the left staff edge as a **virtual start anchor**, not as a fake physical barline.

This distinction matters:

- Physical barlines should still only represent actual vertical line elements that exist in the SVG.
- The virtual start anchor is an internal coordinate for system start, measure mapping, time-signature proximity checks, key-signature opening windows, bracket logic, and audio alignment.

## Options Considered

### Option 1: Use the left staff edge as a virtual system start anchor

Pros:

- Stable across single-staff and multi-staff systems.
- Independent of clef presence and clef spacing.
- Matches the actual engraved system start when there is no physical opening barline.

Cons:

- Requires tracking whether the start anchor is physical or virtual.

### Option 2: Keep clef-based fallback when no opening barline exists

Pros:

- Minimal change to current logic.

Cons:

- Wrong when clefs are omitted or shifted.
- Wrong for single-line systems with large left padding before the first event.
- Still mixes visual symbol placement with the structural system start.

### Option 3: Back-project from the first visible vertical line by a fixed offset

Pros:

- Simple.

Cons:

- Brittle across fonts, exporters, and time-signature widths.
- Not structurally grounded.

## Decision

Use Option 1.

## Detection Rule

Treat the system as lacking a physical opening barline when either of these is true:

1. There is no valid opening vertical line cluster.
2. The leftmost valid vertical line sits far enough to the right of the left staff edge that it clearly represents a later barline.

The distance threshold should be based on staff geometry rather than a hard-coded pixel constant. A multiple of staff space is the correct unit.

## Proposed State Model

Add an explicit distinction between:

- `system start anchor`
- `physical opening barline`

The implementation should store:

- `globalSystemInternalX`: system start anchor in SVG/internal coordinates
- `globalSystemBarlineScreenX`: screen-space start anchor used by downstream heuristics
- `window.globalAbsoluteSystemInternalX`: absolute start anchor already used by downstream mapping
- `window.hasPhysicalStartBarline`: whether the anchor corresponds to an actual opening barline element

## Behavior

### When a physical opening barline exists

- Keep the existing behavior.
- Highlight the opening barline elements.
- Set the start anchor to the actual physical opening barline.
- Set `hasPhysicalStartBarline = true`.

### When no physical opening barline exists

- Do not highlight any fake opening barline.
- Set the start anchor to the left staff edge.
- Preserve later vertical lines as later barlines.
- Set `hasPhysicalStartBarline = false`.

## Downstream Effects

This virtual start anchor should drive:

- barline-to-measure mapping
- time-signature proximity checks
- opening key-signature windows
- bracket search windows
- audio alignment start filtering

No downstream module should assume the first anchor must correspond to a highlighted barline element.

## Testing

Add a regression that verifies all of the following on a no-opening-barline fixture:

- The system start anchor equals the left staff edge.
- The first later physical barline is not mistaken for an opening barline.
- Downstream logic still receives a usable system start anchor.
