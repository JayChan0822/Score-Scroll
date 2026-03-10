# SVG Analysis Module Extraction Design

## Goal

Extract the SVG preprocessing and render-queue analysis pipeline from `scripts/app.js` into a dedicated module without changing runtime behavior.

## Scope

This extraction covers:

- `preprocessSvgColors`
- `buildRenderQueue`
- `buildTimeSignatureStaffBandsFromLineYs`
- small parser-local helpers used only by that pipeline

This extraction does not cover:

- `initScoreMapping`
- `renderCanvas`
- highlight scanners such as `identifyAndHighlightClefs`

## Recommended Approach

Create `scripts/features/svg-analysis.js` with a `createSvgAnalysisFeature(...)` entry point.

The feature owns the full preprocessing and render-queue construction pipeline and returns an analysis result object instead of mutating top-level app state directly.

`scripts/app.js` stays responsible for:

- invoking the feature after SVG import
- writing returned values back into existing app state
- mirroring the returned staff-line/system-internal-x data onto `window` for legacy consumers

## Inputs

The analysis feature should receive only the small external dependencies it actually needs:

- `getMathFlyinParams`
- `getFallbackSystemInternalX`

Browser globals such as `window`, `document`, `Path2D`, and `getComputedStyle` remain used inside the module because this code is browser-only and already tightly coupled to SVG DOM APIs.

## Outputs

The analysis result should include:

- `renderQueue`
- `stickyMinX`
- `globalStickyLanes`
- `globalAbsoluteStaffLineYs`
- `globalAbsoluteSystemInternalX`

## Low-Risk Cleanup

While extracting, consolidate parser-local helpers into the module and keep `window.globalAbsoluteStaffLineYs` / `window.globalAbsoluteSystemInternalX` writeback in `app.js` instead of spreading that mutation across the parser itself.

## Verification

- Add a failing smoke regression first that requires `scripts/features/svg-analysis.js` and app wiring
- Run the focused smoke test to see it fail
- Implement the module extraction
- Run `npm run typecheck`
- Run the full Playwright smoke suite
