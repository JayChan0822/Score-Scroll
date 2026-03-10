# Auto Fit Zoom Design

## Goal

Automatically fit the imported SVG score to the viewport height so the top and bottom of the score stay visible without manual zoom adjustment.

This auto-fit behavior should run when:

- an SVG is imported
- the export aspect ratio changes
- the browser window size changes

The zoom slider and zoom percentage display must stay in sync with the auto-computed zoom value.

## Current Problem

The current app keeps `globalZoom` entirely manual. Importing an SVG, changing the export ratio, or resizing the window only resizes the canvas and viewport. None of those actions recompute zoom from score height.

There is also an accuracy issue in `processSvgContent()`: the code computes a content-aware `globalScoreHeight`, then immediately overwrites it with `svgRect.height`. That makes any later height-fitting logic less reliable.

## Recommended Approach

Add a small dedicated `fitScoreToViewportHeight()` helper in `scripts/app.js`.

The helper should:

- read the current viewport height
- compute `fitZoom = viewportHeight / globalScoreHeight`
- clamp the result to the existing zoom range
- update `globalZoom`
- sync the zoom slider and percentage display
- call `resizeCanvas()` and `renderCanvas()`

This keeps the existing manual zoom behavior intact while allowing the app to automatically reset zoom at the required moments.

## Trigger Rules

Auto-fit should run only in preview mode and only when score geometry is available.

### Run auto-fit

- after SVG import finishes and score geometry is computed
- after export ratio changes the viewport shape
- after browser window resize changes the viewport size

### Do not auto-fit

- during MP4 export
- during PNG export
- while the user is merely dragging the zoom slider

That keeps export rendering stable and avoids unexpected zoom changes during output generation.

## Fit Calculation

Use the content-aware `globalScoreHeight` instead of the raw SVG bounding box height.

The helper should bail out if:

- there is no loaded score
- `viewportEl` is missing
- `globalScoreHeight` is not finite or non-positive
- export mode is active

The computed zoom should continue using the existing clamp range of `0.2` to `3`.

## UI Behavior

The zoom slider remains manually adjustable.

However, when one of the three auto-fit triggers happens later, auto-fit takes control again and updates:

- `globalZoom`
- `#zoomSlider`
- `#zoomValDisplay`

This matches the approved behavior that window-size changes and ratio changes should re-adapt the score automatically.

## Test Strategy

Add a regression fixture with a score taller than the viewport so auto-fit produces a visible zoom change.

The smoke coverage should assert:

- SVG import changes the zoom slider from its initial value
- changing export ratio changes the zoom value again
- changing browser viewport size changes the zoom value again

Also add a structural assertion that the app exposes a dedicated auto-fit helper and that ratio-change / resize flows call into it.
