# Sebastian Opening Clef Design

## Goal

Make Dorico-exported `Sebastian` opening treble clefs recognize as clefs when the SVG uses an unregistered path-outline variant.

## Root Cause

The opening treble clef in `01 - Full score - 长城谣 - 001.svg` is exported as a `path`, not a text glyph. Its simplified path signature is:

`MCCCCCCCCLCCCLMCCCCCCMCCLCCMCCCCCCCCCCCCCLLCCCCCCCCCCCCL`

Current clef detection in `scripts/app.js` only succeeds when that simplified signature exists in `scripts/data/music-font-registry.js`. The `Sebastian` registry currently lacks this outline variant, so `identifyClefOrBrace()` returns `null`.

## Options

1. Add the missing `Sebastian` treble-clef signature to the registry.
   This is the recommended option. It fixes the actual gap with minimal blast radius and keeps the clef pipeline unchanged.

2. Add geometry heuristics for left-edge spiraling paths.
   This is broader and riskier. It can catch more unregistered clefs, but it increases false positives and couples logic to shape geometry.

3. Special-case this exact SVG or exact transform region.
   This would unblock the file, but it is too brittle and not acceptable as a general fix.

## Chosen Design

Add the missing `Sebastian` treble-clef signature to the music-font registry and lock the behavior with a regression test using `tests/fixtures/no-opening-barline-single-staff.svg`.

## Verification

- Add a smoke test asserting the leftmost highlighted clef in the fixture exists near the system start.
- Run the new targeted test red-green.
- Run `npm run typecheck`.
- Run `npx playwright test` to catch regressions in symbol classification.
