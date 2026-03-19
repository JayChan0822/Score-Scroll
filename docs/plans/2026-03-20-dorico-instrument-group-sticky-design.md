# Dorico Instrument Group Sticky Design

## Goal
Detect Dorico opening instrument-group labels such as `Woodwinds` and their associated geometric brackets as one dedicated sticky identity that pins from the opening and stays fixed like instrument names.

## Problem
The current pipeline only recognizes opening left-column instrument names as `InstName` and bracket geometry as `Brace`.

That means the vertical Dorico group labels in `乐器组括号.svg` are left as generic text, while their brackets remain generic brace stickies. Because the label and bracket never become one modeled unit, they cannot pin as one composite opening block.

## Decision
Use Dorico-only preclassification for vertical instrument-group labels and register each label plus its opening brace cluster as an `instGroup` shared sticky group.

- Add a dedicated DOM class for candidate labels: `.highlight-instgroup-label`.
- Reuse the existing geometric-brace detection for bracket segments.
- Pair each label with the nearest opening brace cluster on its right whose vertical span covers the label center.
- Register each matched set in `globalStickySharedGroups` with one opening block so the existing shared-sticky activation path can pin them together.

## Recognition Rules
- Only run this logic for Dorico SVGs.
- Candidate labels must be readable `text` nodes in the far-left opening gutter and must not already be classified as instrument names, rehearsal marks, clefs, time signatures, or music glyphs.
- Prefer transforms close to a 90-degree rotation, for example `matrix(0,-0.5,0.5,0,...)`, which is the exact pattern used by the sample SVG.
- Require the label column to sit left of the normal `InstName` column and left of the opening barline.
- If no reliable brace cluster matches a label, still register the label alone as an `instGroup` so the name can pin.
- If a brace cluster does not match a label, keep its existing `brace` behavior unchanged.

## Data Flow
- `scripts/app.js`
  - Add a Dorico-only `identifyAndHighlightInstrumentGroupLabels()` pass.
  - Run it after opening bracket detection and before normal instrument-name detection.
  - Ensure normal instrument-name classification skips `.highlight-instgroup-label`.
- `scripts/features/svg-analysis.js`
  - Read the new symbol type for `.highlight-instgroup-label`.
  - Preserve those label items in `renderQueue`.
  - Build `instGroup` shared sticky groups by pairing label items with opening brace items.
  - Stamp every matched child item with `sharedStickyGroupId`, `sharedBlockIndex`, and `sharedLockDistance`.
- `scripts/app.js` render loop
  - Keep using the existing `globalStickySharedGroups` activation path.
  - Do not attach `instGroup` behavior to staff-lane visibility switching.

## Rendering Behavior
- Treat each instrument group as one opening-only shared sticky block.
- Keep the original geometry and relative spacing: label on the left, bracket on the right.
- Pin the full group from the opening lock point and keep it visible for the whole score, matching the requested instrument-name-like behavior.
- Keep the composite group visually stable in the left gutter so generic brace stickies do not overpaint it.

## Matching Rules
- Limit pairing to the opening gutter, not mid-system content.
- For each `.highlight-instgroup-label`, search rightward for `Brace` items whose combined `minY` / `maxY` span covers the label center Y.
- Require the matched brace geometry to stay between the label column and the normal instrument-name column.
- If multiple brace candidates qualify, prefer the closest one in X and the narrowest one in Y that still covers the label center.
- Include all connected brace parts for the chosen group, not just the main vertical line, so top and bottom caps pin with the label.

## Testing
- Add smoke coverage using `乐器组括号.svg` to confirm:
  - `Woodwinds`
  - `Horn`
  - `Strings Solo`
  - `Strings Ensemble`
  receive `.highlight-instgroup-label` and are not folded into `.highlight-instname`.
- Add analysis/render coverage to confirm each group label and its brace parts share one `sharedStickyGroupId`.
- Confirm `sharedLockDistance` stays opening-locked and does not depend on lane activation or later system visibility.
- Re-run existing brace and opening-instrument smoke coverage to guard against regressions.

## Non-Goals
- No MuseScore or Sibelius support in this iteration.
- No full left-gutter refactor.
- No change to normal `brace` behavior when an instrument-group match is not found.
