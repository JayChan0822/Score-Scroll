# Equal-Height Export Preview Layout Design

## Goal
Keep the desktop preview column the same height as the left control column at all times, while allowing the preview content width to adapt when export aspect ratio changes.

## Layout Strategy
- Desktop only: preserve the existing stacked mobile layout.
- The left control stack becomes the height anchor.
- The right stage column and viewport fill that same height instead of changing height per export ratio.
- Export ratio changes alter the inner preview content width and centering, not the outer viewport height.

## Rendering Strategy
- Keep using the shared export-dimension calculation for true export sizing.
- Derive a preview frame width from the fixed viewport height and selected export ratio.
- Center narrower preview frames inside the viewport and let wider ones clamp to available width.
- Continue using the actual export dimensions for encoding so preview fidelity and export output stay aligned.

## Implementation Notes
- Update desktop layout CSS so `.stage-wrap` and `#viewport` stretch to the control column height.
- Replace the current desktop preview-height syncing with a width-syncing function that computes the preview frame width from the fixed height.
- Preserve existing mobile behavior and export modal behavior.

## Testing
- Add a runtime test that desktop preview and control column heights stay equal when switching ratios.
- Add a runtime test that the preview width changes across ratios while height stays fixed.
- Re-run export preview and MP4/PNG regressions to confirm export behavior is unchanged.
