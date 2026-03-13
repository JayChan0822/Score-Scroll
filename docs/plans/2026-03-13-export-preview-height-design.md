# Export Preview Height Sync Design

## Goal
Make the on-page preview viewport height track the actual exported video height whenever export resolution or aspect ratio changes, so the user can frame the export accurately before rendering.

## Approach
Reuse the same export dimension calculation for both the encoder and the interactive preview. The preview keeps its normal browsing behavior until export settings change, then we update the viewport height to the computed export height, resize the canvas, and redraw. Export rendering still uses its own offscreen/export canvas path, so preview sizing and encoding stay decoupled.

## Scope
- Sync preview height from export resolution and aspect ratio controls.
- Recompute after score load and window resize.
- Do not change the actual export encoding path beyond reusing the dimension helper.

## Implementation Notes
- Extract or reuse `computeExportDimensions()` so app-side preview logic can consume it.
- Add a preview sync function in `scripts/app.js` that reads current export controls, calculates target height, applies it to `viewportEl`, and triggers canvas resize/redraw.
- Hook the sync to export ratio changes, export resolution changes, score load completion, and resize handling.
- Keep mobile and desktop layout guardrails from existing viewport sizing logic, but let the final preview height come from export dimensions instead of fixed clamps when export controls are active.

## Testing
- Add a failing runtime test that changes export ratio and resolution and checks the viewport height matches the exported target height.
- Add a static guard that the app listens to both export ratio and export resolution for preview syncing.
- Re-run the relevant export tests to ensure PNG/MP4 export behavior is unchanged.
