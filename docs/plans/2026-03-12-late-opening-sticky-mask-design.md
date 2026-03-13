# Late Opening Sticky Mask Design

## Problem

Some scores begin in C major with no opening key signature, then introduce a key change later. The current sticky-lane builder still treats the first later `KeySig` block as that lane's opening sticky block because it always anchors a sticky type to `typeBlocks[type][0].minX`.

In `/Users/jaychan/Library/Mobile Documents/com~apple~CloudDocs/__Work_Projects__/__Dorico Projects__/20250518_登山/Scores/01 - Scroll - 登山 - 001.svg`, that means:

- a later mid-score key-signature block gets `lockDistance = 0`
- the block activates from the start of playback
- the left-side mask expands across almost the entire canvas
- later score content looks blank even though it is still being drawn

The same render path also redraws bridge staff lines under the mask from a five-line-only cache, so single-line percussion staves disappear inside the masked region.

## Chosen Approach

Keep the existing sticky-lane architecture, but tighten the definition of an opening sticky block and split bridge-line data from staff-lane data.

1. A type only gets an opening anchor when its first block starts near `stickyMinX`.
2. If a lane has no true opening block for that type, later blocks still become sticky, but only after the playhead reaches their own x-position.
3. Preserve the existing cleaned five-line cache for lane construction and barline logic.
4. Add a separate bridge-line cache that keeps all long horizontal staff lines, including single-line percussion.

This keeps the current render model intact while fixing the two observed failures.

## Detection Rules

### Opening sticky eligibility

- `inst` keeps current behavior.
- `clef`, `key`, `time`, `bar`, and `brace` only get opening-anchor treatment when their first block starts within the opening window near `stickyMinX`.
- If the first block is later than that window, treat the type as having no opening block:
  - `baseWidths[type] = 0`
  - `lockDistance` is measured from `stickyMinX`, not from the later block itself

That means a later modulation key signature in a C-major opening no longer pins from frame zero.

### Bridge-line redraw

- Keep `globalAbsoluteStaffLineYs` as the cleaned five-line array used for staff-band construction.
- Add `globalAbsoluteBridgeLineYs` as the deduped all-staff horizontal-line array.
- Use `globalAbsoluteBridgeLineYs` for mask bridge redraw so single-line percussion staves are drawn through the masked region.

## Non-Goals

- No changes to mid-score key-signature classification
- No changes to barline promotion beyond the already-added fragmented coverage fix
- No new sticky categories or render layers

## Validation

- Add an analysis regression proving later-only key-signature blocks do not start with `lockDistance = 0`.
- Add an analysis regression proving bridge-line data includes lines beyond the five-line staff cache for the Dengshan import.
- Re-run the existing Dengshan fragmented-barline smoke plus the no-opening-barline bridge regression.
