# Preview Focus Mode Design

## Goal
Replace the current browser fullscreen behavior with an in-page preview focus mode that hides the page title and left control panels so the right preview area fills the page content area.

## UX Strategy
- Keep the existing pill control in the preview viewport and reuse its button position.
- Interpret the button as a page-layout toggle, not a browser fullscreen action.
- Hide `header` and `.control-stack` while focus mode is active so the preview becomes the only visible workspace content.
- Use a standard four-corner fullscreen-style icon:
  - outward corners when entering focus mode
  - inward corners when exiting focus mode

## Layout Strategy
- Toggle a single page-level state class such as `body.preview-focus-mode`.
- In focus mode, collapse the current two-column `.workspace-layout` into a single preview column.
- Let `.stage-wrap` and `#viewport` expand to the available page width and near-full viewport height.
- Preserve the existing preview pill position at the top-left of `#viewport`.

## Implementation Notes
- Keep the existing preview button DOM entry point rather than introducing a second control.
- Remove `requestFullscreen()` / `exitFullscreen()` usage from `scripts/app.js`.
- Replace that logic with a focus-mode toggle that adds/removes a body class and then reruns the existing preview sizing and canvas resize flow.
- Add CSS rules in `styles/layout.css` and `styles/stage.css` to hide non-preview UI and stretch the preview column.
- Keep export sizing, playback, and zoom logic unchanged aside from reacting to the larger container.

## Accessibility And State
- Update the button `title`, `aria-label`, and pressed state as the mode changes.
- Keep the button available in focus mode so exit is always one click away.
- Do not enter browser fullscreen; `document.fullscreenElement` should remain `null`.

## Testing
- Replace the current browser-fullscreen smoke test with a focus-mode smoke test.
- Assert that clicking the pill button hides `header` and `.control-stack`, keeps `#viewport` visible, and enlarges the preview area.
- Assert that clicking again restores the default layout.
- Assert that the interaction does not set `document.fullscreenElement`.
