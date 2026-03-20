# Desktop Auto Preview Width Feedback Loop Design

## Goal
Stop desktop `Auto (自适应)` preview mode from shrinking and flickering when score zoom makes the SVG taller than the preview viewport.

## Root Cause
- Desktop preview sizing currently fixes preview height to the control column, then derives `Auto` preview width from `computeSharedExportDimensions(...)`.
- That `Auto` export helper uses the current preview width as an input when computing a virtual export zoom.
- Once score zoom increases enough, the computed height grows, which makes the preview width shrink, which then increases the next computed zoom again.
- The resulting width feedback loop repeatedly resizes the canvas and causes visible flicker.

## Chosen Fix
- Keep the existing equal-height desktop layout.
- For desktop `Auto` preview only, stop deriving preview width from SVG/export dimensions.
- Instead, let the preview frame fill the available stage width and keep height pinned to the control column.
- Preserve existing non-`Auto` ratio behavior and leave export dimension calculations unchanged.

## Testing
- Add a regression that asserts desktop `Auto` preview width does not change when the zoom slider increases enough to make the score taller.
- Re-run the preview sizing smoke coverage to confirm ratio-based non-`Auto` width changes still work.
