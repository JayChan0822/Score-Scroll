# Viewport Fullscreen Pill Control Design

## Goal
Add a web fullscreen toggle for the preview viewport inside the existing zoom pill, positioned to the right of the `+` button and styled consistently with the existing zoom controls.

## UX Strategy
- Keep the control inside the existing `.zoom-control-wrapper` so zoom and fullscreen remain a single preview-toolbar cluster.
- Target only `#viewport` for fullscreen so the left control column stays out of fullscreen mode.
- Use the same visual treatment as the `+` and `−` buttons.
- Swap the button icon, tooltip, and accessible label when fullscreen state changes.

## Interaction Model
- Clicking the new button enters fullscreen when `#viewport` is not the active fullscreen element.
- Clicking it again exits fullscreen when `#viewport` is active.
- Pressing `Esc` or any browser-driven fullscreen exit path must also resync the button state.
- If the browser does not expose the Fullscreen API, keep the button disabled instead of failing silently.

## Implementation Notes
- Add a `viewportFullscreenBtn` button in `index.html` between `#zoomInBtn` and `#zoomValDisplay`.
- Reuse `.zoom-btn` styling in `styles/stage.css`; add only the minimal icon/state styling needed for the fullscreen button.
- Extend `scripts/core/dom.js` so the fullscreen button is available through `getDomRefs()`.
- In `scripts/app.js`, add small helpers for fullscreen enter, exit, state detection, and button-state syncing.
- Listen to `fullscreenchange` so the button stays accurate after `Esc` exits or rejected transitions.
- Keep fullscreen logic independent from zoom logic, export sizing, and playback/rendering paths.

## Testing
- Add a smoke test that the fullscreen button renders inside the zoom pill between the `+` button and the zoom percentage.
- Add a smoke test that clicking the button makes `document.fullscreenElement` become `#viewport`, and that toggling back clears fullscreen state.
- Re-run the existing zoom-pill position test to confirm the new control does not disturb toolbar placement.
