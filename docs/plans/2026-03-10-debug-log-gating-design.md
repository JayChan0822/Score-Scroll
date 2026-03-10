# Debug Log Gating Design

## Goal

Stop the current flood of development-only console output during normal use while keeping the logging code easy to re-enable later.

## Scope

This change covers:

- converting development-only `console.log(...)` calls to a shared `debugLog(...)` helper
- keeping `console.warn(...)` and `console.error(...)` untouched
- defaulting debug logs to disabled

This change does not cover:

- URL-based debug toggles
- local storage or UI switches for logging
- removal of warning or error reporting

## Recommended Approach

Add a small shared debug utility and route pure debug logs through it.

The utility should live in `scripts/utils/debug.js` and export:

- `DEBUG_LOGS_ENABLED = false`
- `debugLog(...args)`

`debugLog(...)` should call `console.log(...)` only when the constant is enabled.

This keeps the runtime quiet by default without scattering commented-out logs across the codebase.

## Target Files

- `scripts/app.js`
- `scripts/features/svg-analysis.js`
- `scripts/features/timeline.js`
- `scripts/features/audio.js`

These files currently contain pure progress and instrumentation logs that are useful during debugging but noisy in normal use.

## Logging Rules

- Convert development-only `console.log(...)` calls to `debugLog(...)`
- Keep `console.warn(...)` and `console.error(...)` as-is
- Do not change control flow or behavior around these log sites

## Verification

- Add a failing regression first that requires the shared debug utility and the migration of pure debug logs away from direct `console.log(...)`
- Run the targeted regression to confirm failure
- Implement the helper and migrate the selected logs
- Run `npm run typecheck`
- Run `npx playwright test tests/score-scroll-smoke.spec.js`
