# KeySig Accidental Classification Revert Design

**Goal:** Restore the original mid-score accidental behavior so note-adjacent accidentals win first, then spread by contagion, while keeping the newer trusted barline anchor filtering.

**Problem:** The current `symbol-graph` suffix-splitting rule is too conservative for stacked accidentals near the first notehead. In `01 - Full score - 长城谣 - 001 (1).svg`, legitimate key-signature clusters are being dropped entirely when a nearby accidental suffix sits close to the first note, even though the trusted-anchor filtering is still correct.

**Decision:** Keep `buildTrustedBarlineAnchors()` and the staff-aware candidate preparation, but replace the final `keysig/accidental` classification with the earlier note-proximity-first model. That means:
- candidates very close to noteheads become accidental seeds immediately
- accidental contagion propagates within the same staff lane and local cluster
- trusted-anchor key signatures are whatever leading candidates remain after accidental seeds and contagion are removed

**Approach:**
- Rewrite `classifyAccidentalGroups()` in `scripts/features/symbol-graph.mjs`
- Preserve the existing trusted anchor window and staff-band inputs
- Reintroduce a compact contagion pass inside `symbol-graph` so we can keep the newer anchor hygiene without relying on the overly tight suffix splitter

**Testing:**
- Add a pure regression that proves a key-signature prefix survives when a note-adjacent accidental suffix is present
- Add a smoke regression for the two `长城谣` windows that were regressed by the suffix splitter
- Keep the existing `武则天` and measure-23 piano sharp regressions green
