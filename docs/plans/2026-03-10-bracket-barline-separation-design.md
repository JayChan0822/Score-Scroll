# Bracket And Barline Separation Design

## Goal

Fix SVG imports where left-of-system bracket lines are missed because bracket detection is coupled to barline detection.

The target behavior is:

- the first true system barline stays classified as a barline
- every vertical line immediately to the left of that first barline is classified as a bracket line
- bracket detection no longer depends on a line already being marked as `highlight-barline`

## Current Failure

`identifyAndHighlightGeometricBrackets()` currently filters candidate verticals with `seg.element.classList.contains('highlight-barline')`.

That means bracket detection only sees verticals that barline detection has already accepted. In the failing Dorico SVG, the opening bracket line is a separate vertical polyline to the left of the first barline, so it never enters the bracket candidate set.

This couples two different concepts:

- barlines: structural measure/system lines
- bracket lines: grouping lines that sit to the left of the first system barline

Because they are coupled, a correct bracket line can be lost even when it is geometrically obvious.

## Approved Constraint

The user clarified a simplifying domain rule:

- every vertical line to the left of the first system barline should be treated as a bracket line
- there may be more than one such bracket line
- the critical part is identifying the first true system barline precisely

This lets the fix stay simple and low risk.

## Recommended Approach

Split bracket recognition from barline recognition, but keep both inside the current `identifyAndHighlightGeometricBrackets()` pipeline.

1. Independently lock the first true system barline in the left-edge search area.
2. Mark all qualifying verticals in a narrow band immediately to the left of that barline as bracket lines.
3. Keep the existing short horizontal-cap support so current bracket detection still works where present.

This avoids rewriting the scanner and only changes the candidate-selection rule.

## First-Barline Locking

The first barline should be re-derived geometrically instead of inherited from `highlight-barline`.

Use these signals:

- candidate must be a vertical line near the left system start region
- candidate must be materially taller than local bracket segments
- when nearby verticals form a left-edge column, prefer the rightmost tall structural line as the first barline

This matches the user’s constraint that left-of-barline verticals are brackets, not barlines.

## Bracket-Line Selection

Once the first barline X is known:

- scan a narrow window immediately to its left
- collect vertical lines in that window
- exclude the first barline itself
- mark every remaining vertical in that window as `highlight-brace`

This should support both:

- a single bracket line left of the barline
- multiple stacked bracket lines left of the same barline

## Compatibility

Keep the existing horizontal-cap logic as a secondary path so already-working bracket cases continue to highlight their short cap segments.

The barline detector itself should stay unchanged in this fix. Only bracket detection becomes independent.

## Test Strategy

Add a dedicated regression fixture that contains:

- one tall first system barline
- multiple vertical bracket lines immediately to its left
- optional short horizontal caps

The regression should assert:

- the first system line remains the barline
- the left-of-barline verticals are all classified as brackets
- bracket detection does not require those lines to also be barlines
