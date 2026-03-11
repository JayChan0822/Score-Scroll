# Opening Key Signature Preservation Design

**Date:** 2026-03-11

**Problem**

Two imported SVGs lose the opening `Piano` key signatures after initial detection:

- `/Users/jaychan/Desktop/Choir with piano.svg`
- `/Users/jaychan/Desktop/Green Tea Farm - Full score - 01 Flow 1.svg`

The opening flats are first classified as `highlight-keysig`, then reclassified as `highlight-accidental` by the contagion pass.

**Root Cause**

`identifyAndHighlightAccidentals()` mixes coordinate spaces:

- staff bands are built from raw SVG line `y` values
- noteheads and accidental candidates use `getBoundingClientRect()` screen-space values

When the imported SVG has transforms, `resolveBandIndex()` fails for opening key signatures and nearby noteheads, so both fall back to `bandIndex = -1`. The contagion algorithm then uses only loose vertical-distance checks and treats the opening piano flats as accidentals because the first noteheads are immediately to their right.

**Approved Scope**

Only preserve system-opening key signatures. Do not change mid-system accidental behavior.

**Approach**

1. Normalize the accidental pass to screen-space staff bands.
2. Add a narrow opening-key-signature guard before contagion:
   for each staff band, the consecutive accidentals between system start and the first notehead remain `highlight-keysig`.
3. Leave the rest of the accidental contagion algorithm unchanged.

**Why This Approach**

- It fixes the actual root cause instead of tuning thresholds.
- It matches the user-approved scope: preserve opening key signatures only.
- It generalizes across transformed Sibelius/Opus/Helsinki imports without redefining mid-score accidental logic.

**Non-Goals**

- Rewriting the entire accidental detection pipeline
- Changing how later accidentals are classified
- Broadly changing time-signature or instrument-name detection

**Validation**

Add regressions that assert:

- `Choir with piano.svg` keeps the two opening `Piano` flats as `highlight-keysig`
- `Green Tea Farm - Full score - 01 Flow 1.svg` keeps the opening `Piano` flats as `highlight-keysig`
- existing smoke tests still pass
