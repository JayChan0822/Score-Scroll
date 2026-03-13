# Full-Viewport Preview Focus Design

## Goal
Make the preview-focus button promote the preview card into a true full-viewport in-page mode so the preview visibly fills the browser window while preserving the rounded viewport frame.

## UX Strategy
- Keep the existing pill button location and keep it as the single entry/exit point.
- Preserve the rounded preview frame rather than switching to hard screen edges.
- Hide all non-preview page content while focus mode is active, including `header`, `.control-stack`, and decorative overlays that reduce clarity.
- Make the preview card visually dominate the browser viewport so the transition is obvious even on large displays.

## Layout Strategy
- Stop relying on the existing `.workspace-layout` flow to enlarge the preview.
- In focus mode, move `.stage-wrap` into a fixed, top-level viewport-filling layout state using `position: fixed`.
- Use a small inset around the browser edges so the card keeps rounded corners and does not feel clipped.
- Let `#viewport` fully occupy the fixed `.stage-wrap` bounds.

## Implementation Notes
- Reuse the existing `body.preview-focus-mode` state and the current focus-mode button semantics.
- Replace the current "single-column expanded layout" focus-mode CSS with a true fixed-position overlay-style layout for `.stage-wrap`.
- Remove layout constraints from `.app-shell`, `.workspace-scale-frame`, and `.workspace-layout` that still limit the preview size during focus mode.
- Keep using the existing resize/redraw path after toggling so the canvas remeasures against the new fixed container.

## Accessibility And State
- Keep the button visible inside the preview card so exiting is always available.
- Preserve the current outward-corner / inward-corner icon states.
- Continue avoiding the browser Fullscreen API; this remains an in-page mode only.

## Testing
- Tighten the focus-mode smoke test so it verifies the preview card meaningfully approaches viewport-sized dimensions.
- Assert that `.stage-wrap` becomes fixed-position in focus mode.
- Assert that `header` and `.control-stack` are hidden and that `#viewport` remains visible with rounded corners.
- Assert that exiting focus mode restores the normal page layout.
