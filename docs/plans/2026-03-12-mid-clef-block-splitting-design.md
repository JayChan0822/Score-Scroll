# Mid-Clef Block Splitting Design

**Goal:** Keep consecutive mid-system clef changes in the same staff lane as separate sticky blocks so the later clef can replace the earlier one.

**Problem:** The sticky analysis currently groups every clef block with the same fixed horizontal threshold. In `03 - Scrolling - 我爱你中国 - 001.svg`, the piano lower-staff clef change in measure 34 contains a treble clef followed shortly by a bass clef. Their horizontal gap is smaller than the generic clef merge threshold, so both are merged into one sticky block and pin together on the left.

**Decision:** Keep the existing grouping logic for `key`, `time`, `bar`, and `brace`, but give `clef` its own break rule. When adjacent clef items in the same lane represent different clef identities, they must start a new block even if the x-gap is still below the generic merge threshold.

**Approach:**
- Add a clef-aware block break helper in `scripts/features/svg-analysis.js`.
- Derive clef identity from the existing `identifyClefOrBrace()` hook using each clef item's path signature.
- Use the helper only when building `typeBlocks.clef`.
- Preserve current opening-clef behavior; only mid-system consecutive clefs gain separate sticky blocks.

**Testing:**
- Add an analysis-level regression that builds a minimal SVG and verifies adjacent treble/bass clefs become two `clef` blocks.
- Add a smoke regression for `03 - Scrolling - 我爱你中国 - 001.svg` that confirms the measure-34 piano lower-staff clefs occupy separate sticky blocks, allowing the later clef to replace the earlier one.
