# X Notehead Registry Design

## Goal

Extend the music font registry so every provided desktop music font exposes four duration-specific X notehead categories, and normalize the existing standard notehead categories into the same quarter/half/whole/double-whole shape.

## Scope

- Modify `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/data/music-font-registry.js`
- Modify `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js`
- No runtime logic changes are required because notehead recognition already indexes every entry under `noteheads`

## Data Model

Each supported font will use duration-specific notehead keys:

- `Notehead_Quarter`
- `Notehead_Half`
- `Notehead_Whole`
- `Notehead_DoubleWhole`
- `Notehead_X_Quarter`
- `Notehead_X_Half`
- `Notehead_X_Whole`
- `Notehead_X_DoubleWhole`

For existing standard noteheads:

- current `Notehead_Solid` signatures become `Notehead_Quarter`
- current `Notehead_Hollow[0]` becomes `Notehead_Half`
- current `Notehead_Hollow[1]` becomes `Notehead_Whole`
- current `Notehead_DoubleWhole` stays `Notehead_DoubleWhole`

For text-glyph fonts that only currently expose quarter/half/whole, keep the normalized three-category split and do not invent a double-whole glyph.

For the provided X notehead SVGs:

- use the four paths in source order
- map them to quarter, half, whole, double-whole respectively
- keep duplicate fingerprints if a font genuinely uses the same drawing for multiple durations

## Runtime Impact

`identifyAnyKnownNotehead()` and the active signature maps iterate every child entry under `noteheads`, so this registry-only change automatically makes both standard and X noteheads available to:

- accidental proximity detection
- accidental contagion
- timeline/staff alignment logic

## Testing

Add static registry regressions that verify:

1. the existing desktop path fonts now expose normalized duration-specific standard notehead categories
2. the 12 provided desktop fonts expose all four X notehead categories with the expected fingerprints

No runtime test changes are necessary unless registry structure breaks notehead indexing, because notehead lookup remains data-driven.
