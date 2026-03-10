# JSDoc + `@ts-check` Design

## Summary

This design adds lightweight static type checking to the current Score Scroll codebase without introducing a bundler, changing runtime behavior, or converting files to TypeScript. The goal is to improve confidence in the most stateful and integration-heavy modules first by using JSDoc annotations together with `// @ts-check`.

The first phase is intentionally narrow. It will only cover the core state/DOM modules and the feature modules with the highest coordination cost:

- `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/core/state.js`
- `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/core/dom.js`
- `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/features/audio.js`
- `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/features/export-video.js`
- `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/features/playback.js`

## Goals

- Add command-line type checking with no emitted build artifacts.
- Use `// @ts-check` and JSDoc instead of a TypeScript migration.
- Type only the highest-value modules in the first phase.
- Keep deployment, local serving, and browser behavior unchanged.
- Surface obvious type mistakes around DOM access, state shape, callbacks, and time-mapping helpers.

## Non-Goals

- No file extension changes.
- No bundler or runtime build step.
- No full-project type coverage in this phase.
- No full render queue or music registry modeling.
- No refactors done only to satisfy a checker unless they are trivial and behavior-preserving.

## Recommended Approach

### Check Mode

The project should gain a minimal TypeScript checker configuration:

- `typescript` as a dev dependency
- `tsconfig.json` with:
  - `allowJs: true`
  - `checkJs: true`
  - `noEmit: true`
  - DOM-aware libs
  - an `include` list limited to the first-phase files

`package.json` should also expose a `typecheck` script so this remains a normal verification step instead of an editor-only convenience.

### Typing Strategy

The first phase should prefer local, structural JSDoc types over ambitious global modeling:

- `state.js`
  - define the shape of the app state returned by `createInitialState`
  - include only the fields that exist today
- `dom.js`
  - type each DOM lookup as a specific element subtype or `null`
- `playback.js`
  - type helper options, playback state, and interpolated positions
- `audio.js`
  - type the options object and the minimal render queue / time-map fields actually read by the file
- `export-video.js`
  - type the options object, smooth-state contract, and the getter/setter signatures used by the export pipeline

This avoids over-modeling the app while still making the risky boundaries explicit.

### Third-Party and Browser APIs

The phase should stay pragmatic:

- keep `mp4-muxer` loosely typed where necessary instead of introducing a full vendor declaration package
- use narrow compatibility casts for browser APIs such as `webkitOfflineAudioContext` if the checker needs help
- rely on DOM/Web API types where they already exist

## Rollout

1. Add a failing test that proves the typecheck scaffold does not exist yet.
2. Add `typescript`, `tsconfig.json`, and `npm run typecheck`.
3. Add `// @ts-check` and JSDoc to the five target files.
4. Run the targeted typecheck and fix only real issues in those files.
5. Re-run the existing smoke suite to ensure runtime behavior stayed stable.

## Success Criteria

- `npm run typecheck` exists and passes.
- The five target files are opted into `// @ts-check`.
- The checker runs with `noEmit`.
- The browser app still passes the current smoke suite unchanged.
