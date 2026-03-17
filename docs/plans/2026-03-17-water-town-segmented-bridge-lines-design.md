# Water Town Segmented Bridge Lines Design

**Problem**

`水乡记忆.svg` has segmented opening staff lines for the `Flute 2` and `Oboe 2` rows. Once those rows pin into the sticky mask, the mask redraw shows no five-line staff behind them.

**Root Cause**

- Sticky mask redraw does not reuse the source SVG. It redraws only the cached bridge lines in `globalAbsoluteBridgeLineYs`.
- `scripts/features/svg-analysis.js` currently dedupes raw horizontal lines by `y` and keeps only the single widest segment per row before envelope filtering.
- In this score, the affected staves are split into multiple adjacent horizontal segments on the same `y`, so the “keep the widest segment” rule discards the rest of the row and the resulting segment no longer matches the dominant full-span envelope.

**Chosen Design**

1. Merge adjacent horizontal bridge-line segments that belong to the same visual staff row before dominant-envelope filtering.
   - Keep the existing `y` tolerance behavior.
   - Only merge segments whose gap is small relative to the score width, so unrelated horizontal marks do not get stitched into staff lines.
2. Run the existing dominant-envelope and five-line validation on the merged rows.
   - This keeps the current bridge redraw architecture intact.
   - It limits the change to bridge-line caching and avoids touching sticky item classification.

**Expected Result**

- The segmented Water Town `Flute 2` and `Oboe 2` rows contribute full-width bridge lines to `globalAbsoluteBridgeLineYs`.
- Sticky mask redraw shows five staff lines behind those pinned rows.
- Existing full-span bridge-line filtering still rejects unrelated short horizontal graphics.
