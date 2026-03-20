# Particles Slider Double-Click Reset Design

## Goal

Allow double-clicking anywhere on these six range sliders to reset them back to `50`:

- `distSlider`
- `scatterSlider`
- `delaySlider`
- `glowRangeSlider`
- `playlineRatioSlider`
- `stickyLockRatioSlider`

## Context

These sliders already update application state through existing `input` listeners wired in `scripts/features/ui-events.js`. The displayed percentages and downstream redraw/save behavior already live behind those handlers.

## Recommended Approach

Bind a `dblclick` listener only to the six target sliders inside `bindUiEvents()`. On double-click:

1. set the slider value to `"50"`
2. dispatch a bubbling `input` event

This keeps all state changes flowing through the existing handlers instead of duplicating update logic.

## Why This Approach

- Minimal scope: only the six requested sliders change
- Low risk: no changes to the slider math or state model
- Consistent behavior: labels, redraws, and local settings reuse the current `input` path

## Rejected Alternatives

### Add separate reset callbacks per slider

Works, but duplicates existing input behavior and increases maintenance cost.

### Generalize all range inputs to support double-click reset

Too broad for the requirement and risks changing unrelated sliders such as BPM or audio offset.

## Testing

Add a smoke test that:

1. sets each target slider away from `50`
2. double-clicks each slider
3. verifies both the slider value and its visible percentage label return to `50`
4. verifies a non-target range slider does not gain reset-on-double-click behavior
