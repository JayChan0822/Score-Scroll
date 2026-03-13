# Sticky Lock Control And Light Export Fix Design

## Goal
Add an independent horizontal sticky-lock position control beneath the scanline control, and fix MP4 exports in Light mode so the exported background matches the active light theme instead of rendering as black.

## Sticky Lock Control
- Add a new percentage slider labeled `吸顶位置` below `扫描线位置`.
- Keep `playlineRatio` responsible only for the visible scanline.
- Introduce a separate `stickyLockRatio` state used for sticky pinning, sticky mask placement, and bridge redraw anchoring.
- This decouples score-following from sticky placement, so users can place the scanline and sticky stack independently.

## Light Export Fix
- The preview looks correct in Light mode because the viewport DOM supplies the light background.
- MP4 export uses an offscreen canvas with no DOM background behind it, so transparent regions encode as black.
- Fix by filling the full export canvas with the active background color before drawing score content whenever `transparentBackground` is false.
- Keep PNG sequence export transparent by preserving the current transparent branch.

## Testing
- Add tests for the new sticky-lock slider wiring and separate state usage.
- Add an export regression that runs a mocked MP4 export in Light mode and verifies the exported frame background pixel matches the light theme instead of black.
- Re-run the existing MP4/PNG export tests and the recent desktop preview layout tests.
