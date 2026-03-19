# Rehearsal Mark Unified Sticky Height Design

## Goal
Keep pinned rehearsal marks on one shared vertical baseline above the opening clef so higher marks move down and lower colliding marks move up after sticking.

## Problem
The current sticky rehearsal-mark Y offset only resolves downward collision with the opening clef. That means low rehearsal marks get lifted, but rehearsal marks that were originally engraved higher stay higher, so pinned marks in the same lane do not align to one consistent height.

## Decision
Use a lane-level sticky target bottom edge for rehearsal marks when an opening clef anchor exists.

- Compute the target bottom edge from the opening clef top edge minus a small padding.
- Align every active sticky rehearsal block in the lane to that same target bottom edge.
- This produces positive Y offset for originally high rehearsal marks and negative Y offset for low colliding marks.
- If the lane has no opening clef anchor, keep the existing Y position unchanged.

## Data Flow
- Preserve per-item absolute Y bounds during SVG analysis.
- Preserve per-block `minY` / `maxY` when building sticky blocks.
- In `renderCanvas()`, derive the active rehearsal block for each lane and compute one shared target Y offset against the opening clef block.
- Apply that Y offset only while the rehearsal mark is pinned.

## Testing
- Add a sticky-layout regression proving one helper returns:
  - a positive offset for a high rehearsal mark,
  - zero for an already aligned rehearsal mark,
  - a negative offset for a low colliding rehearsal mark.
- Re-run the rehearsal-mark smoke coverage to confirm sticky grouping and boxed-frame pairing still work.
