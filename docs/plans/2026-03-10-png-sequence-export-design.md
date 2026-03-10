# PNG Sequence Export Design

## Goal

Add an `Export PNG` action next to the existing MP4 export button and export a transparent-background PNG image sequence into an auto-created subfolder inside a user-selected directory.

## Scope

This feature covers:

- a new `Export PNG` button in the existing export controls
- reuse of the current export resolution, aspect ratio, FPS, and export-range inputs
- transparent-background frame export that matches the existing MP4 render output
- directory selection and automatic subfolder creation through the File System Access API
- reuse of the existing export modal, progress updates, and cancel flow

This feature does not cover:

- ZIP packaging for PNG frames
- non-Chromium browser support beyond clear capability messaging
- a separate export settings panel for PNG output

## Recommended Approach

Extend the existing export feature instead of building a second parallel export pipeline.

The current MP4 exporter already owns the hard parts: export parameter parsing, offscreen canvas setup, frame-by-frame rendering, progress updates, cancel handling, and cleanup. PNG sequence export should reuse that shared preparation and render loop, then swap only the output target from `VideoEncoder + Mp4Muxer` to `canvas.toBlob("image/png") + File System Access API`.

This keeps MP4 and PNG behavior aligned and avoids maintaining two divergent export systems.

## User Flow

1. The user sets resolution, aspect ratio, FPS, and export range in the existing controls.
2. The user clicks `Export PNG`.
3. The browser prompts for a destination directory.
4. The app creates a timestamped subfolder such as `score-scroll-png-20260310-173015`.
5. The app renders each frame using the existing export render path and writes `frame_000001.png`, `frame_000002.png`, and so on.
6. The export modal shows progress and allows cancellation.

## UI Changes

- Add `Export PNG` immediately to the right of `Export MP4` in `index.html`.
- Reuse the existing button styling and export modal.
- Reuse the existing cancel button and progress bar.

No new modal or settings block is needed.

## Architecture

The implementation stays inside the current export feature module.

- `index.html` adds the new button.
- `scripts/core/dom.js` adds an `exportPngBtn` reference.
- `scripts/features/ui-events.js` binds the new button click handler.
- `scripts/features/export-video.js` expands into a shared export orchestration module with:
  - common export parameter parsing and validation
  - common offscreen canvas setup and teardown
  - common frame iteration and progress reporting
  - MP4-specific output handling
  - PNG-sequence-specific output handling

The feature should expose a dedicated PNG export entry point rather than overloading the MP4 click handler.

## Transparent Background Strategy

PNG export should preserve the existing score visuals, scan line, glow, fly-in effects, and timing behavior. The only visual difference is that the exported frame background must be transparent.

To keep runtime risk low, transparency should be activated only for the export canvas during PNG export. Normal on-screen rendering and MP4 export remain unchanged.

## Error Handling

- If `showDirectoryPicker` or writable file handles are unavailable, show a clear Chrome/Edge-only message and stop.
- If the user cancels directory selection, stop quietly.
- If export range validation fails, reuse the existing validation path and error messages.
- If the user cancels during PNG export, stop rendering additional frames and leave already-written files intact.
- Always restore the original canvas, context, zoom, modal state, and playback/export flags during cleanup.

## Verification

- Add a failing smoke regression first for the new `Export PNG` button and wiring.
- Add a regression that asserts the export feature exposes a PNG export path and guards for File System Access support.
- Run `npm run typecheck`.
- Run `npx playwright test tests/score-scroll-smoke.spec.js`.
