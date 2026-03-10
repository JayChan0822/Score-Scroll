# Score Scroll Refactor Design

## Summary

This design restructures `/Users/jaychan/Documents/GitHub/Score-Scroll/index 优化版.html` from a single-file static app into a small static-site codebase that is easier to maintain. The goal is to preserve the current UI and behavior while removing obvious redundancy, cleaning formatting, and organizing code by responsibility.

The refactor will assume access through a local static server instead of opening the HTML file directly from disk. That allows the JavaScript to move to native ES modules without adding a bundler.

## Goals

- Keep the current UI layout, control surface, and main behaviors intact.
- Split inline CSS and JavaScript into clearly named files.
- Organize JavaScript by feature and dependency direction.
- Remove low-risk redundancy and dead references discovered during extraction.
- Reduce future maintenance cost by centralizing DOM lookups, shared state, and static data.

## Non-Goals

- No UI redesign.
- No framework migration.
- No build system or bundler.
- No intentional behavior changes to playback, rendering, MIDI parsing, audio sync, or export beyond low-risk fixes discovered during extraction.

## Current Problems

- `/Users/jaychan/Documents/GitHub/Score-Scroll/index 优化版.html` mixes markup, styles, data, state, algorithms, rendering, and event binding in one file.
- Inline styles are scattered throughout the HTML, making later edits error-prone.
- Global mutable variables and DOM queries are interleaved, which makes dependency order hard to reason about.
- The large `MusicFontRegistry` data block hides the operational logic around it.
- Some DOM references appear to target missing controls, which increases maintenance overhead and confusion.

## Recommended Architecture

The app will stay as a static site, but its code will be split into focused files:

```text
/Users/jaychan/Documents/GitHub/Score-Scroll/
├─ index 优化版.html
├─ styles/
│  ├─ main.css
│  ├─ tokens.css
│  ├─ base.css
│  ├─ layout.css
│  ├─ controls.css
│  ├─ stage.css
│  └─ modal.css
└─ scripts/
   ├─ app.js
   ├─ core/
   │  ├─ constants.js
   │  ├─ state.js
   │  └─ dom.js
   ├─ data/
   │  └─ music-font-registry.js
   ├─ features/
   │  ├─ svg-loader.js
   │  ├─ render-queue.js
   │  ├─ renderer.js
   │  ├─ midi.js
   │  ├─ audio.js
   │  ├─ playback.js
   │  ├─ export-video.js
   │  └─ ui-events.js
   └─ utils/
      ├─ format.js
      └─ math.js
```

## Module Responsibilities

### HTML

`/Users/jaychan/Documents/GitHub/Score-Scroll/index 优化版.html` will keep only:

- semantic page structure
- controls and stage markup
- stable IDs used by JavaScript
- stylesheet imports
- the `mp4-muxer` script
- a single `<script type="module" src="./scripts/app.js">`

Inline styles should be removed where practical and replaced with reusable classes.

### CSS

CSS will be grouped by concern:

- `tokens.css`: CSS variables and shared theme values
- `base.css`: reset, typography, global element rules
- `layout.css`: app shell, bento layout, spacing
- `controls.css`: fields, sliders, buttons, info displays
- `stage.css`: viewport, canvas, zoom controls
- `modal.css`: export modal and progress states
- `main.css`: ordered imports only

### JavaScript Core

- `core/constants.js`: global constants and regular expressions
- `core/state.js`: centralized mutable app state and default values
- `core/dom.js`: single source of truth for DOM references

### JavaScript Features

- `data/music-font-registry.js`: static music font signature data
- `features/svg-loader.js`: SVG load pipeline and sandbox preparation
- `features/render-queue.js`: render queue extraction and derived geometry
- `features/renderer.js`: canvas drawing and visual updates
- `features/midi.js`: MIDI parsing and tempo/time-signature timeline handling
- `features/audio.js`: audio load, onset detection, sync helpers
- `features/playback.js`: transport state, seek, play/pause, progress updates
- `features/export-video.js`: export workflow and modal progress updates
- `features/ui-events.js`: all DOM event binding and handoff to feature methods

### Utilities

- `utils/format.js`: formatting helpers such as seconds and percentages
- `utils/math.js`: shared math helpers for interpolation and clamping

## Data Flow

The modules will coordinate through a shared application context assembled in `scripts/app.js`.

`appContext` will expose:

- `state`: the current mutable application state
- `dom`: cached DOM references
- `services`: functions or module APIs needed across features

The direction of dependency should stay simple:

- `core` and `utils` can be imported by any feature
- `data` is read-only
- `features` should depend on shared context rather than on each other wherever practical
- `app.js` is the composition root and initialization entrypoint

This keeps modules testable and avoids replacing one large global file with several tightly coupled files.

## Low-Risk Safe Optimizations

During extraction, the refactor may safely:

- remove unused DOM queries or stale references that have no matching element
- deduplicate repeated DOM updates where behavior remains identical
- replace repeated inline styles with named CSS classes
- consolidate repeated constants and helper logic
- improve naming where the current names are misleading but behavior remains unchanged

## Testing and Verification Strategy

Because this project currently has no automated UI verification, the refactor should add lightweight smoke coverage before moving major production code:

- serve the app locally over HTTP
- add a browser-level smoke test that proves the page loads without module errors
- assert that key controls and the canvas viewport render
- extend the smoke test as needed for low-risk regressions introduced during refactor

Manual verification should still cover:

- SVG upload
- MIDI upload
- play/pause
- progress seek
- zoom controls
- export modal opening

## Risks

- Native module split can break load order if implicit globals are not identified correctly.
- CSS extraction can accidentally change spacing or control sizing if inline rules are missed.
- The video export path is large and stateful, so any extracted shared state must be validated carefully.
- Audio and MIDI sync code relies on shared mutable state; partial extraction without clear ownership will create regressions.

## Rollout Approach

Use incremental extraction instead of rewriting everything at once:

1. Add smoke-test coverage and static-server verification path.
2. Extract CSS and simplify the HTML shell.
3. Extract shared state, constants, DOM references, and data registry.
4. Move feature logic module by module while keeping behavior stable.
5. Re-run smoke/manual verification after each meaningful slice.

## Success Criteria

- `/Users/jaychan/Documents/GitHub/Score-Scroll/index 优化版.html` becomes a thin shell.
- CSS and JavaScript are grouped by responsibility and readable in isolation.
- The app loads correctly from a local static server with ES modules.
- The existing feature surface remains available.
- The refactor removes obvious redundancy and makes future edits faster and safer.
