# Rehearsal Mark Bottom-Lane Baseline Design

## Goal
Keep sticky rehearsal marks in the bottom staff lane aligned to one shared low baseline below the opening symbols, instead of pulling them above the opening clef.

## Problem
The current sticky rehearsal-mark alignment always uses the opening clef top edge as the reference. That works for upper lanes, but on the bottom lane it wrongly drags rehearsal marks upward above the clef even when they were originally engraved below the staff.

## Decision
Use two vertical sticky baselines:

- Non-bottom lanes: align rehearsal-mark bottom edges to a shared line above the opening clef.
- Bottom lane of each system: align rehearsal-mark top edges to a shared line below the opening opening-symbol envelope.

## Anchor Rules
- Preserve the existing upper-lane anchor from `openingClef.minY - padding`.
- For the bottom lane, compute a lower envelope from the opening sticky blocks in that lane and use `openingEnvelope.maxY + padding`.
- Bottom-lane rehearsal marks align their top edges to that low baseline.

## Testing
- Extend sticky-layout helper coverage with bottom-lane cases:
  - a high bottom-lane rehearsal mark moves down,
  - an already aligned one stays put,
  - an overly low one moves up.
- Re-run rehearsal-mark smoke coverage to ensure grouping and replacement logic still hold.
