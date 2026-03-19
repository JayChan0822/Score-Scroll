# Strict Stacked Time Signature Design

**Problem:** Numeric time-signature detection has drifted away from the original "two stacked numbers" rule. Geometric fallback logic for fragmented fours can directly create `highlight-timesig` elements, and downstream timeline extraction accepts those highlights without re-validating that they came from a confirmed stacked pair.

**Decision:** Restore numeric time-signature detection to a confirmation-first model. Numeric meters are only recognized when two decoded numeric glyphs form a valid stacked pair inside a legal staff band and near a trusted opening or barline anchor. Geometric fragmented-four heuristics are removed from the main time-signature path.

**Scope:**
- Keep confirmed numeric stacked pairs.
- Keep explicit `COMMON` / `CUT` time signatures when decoded from semantic, text, or path sources.
- Remove fragmented-four geometric fallback from opening and late time-signature detection.
- Tighten timeline extraction so single numeric tokens no longer default to `/4`.

**Implementation Notes:**
- `identifyAndHighlightTimeSignatures()` becomes the single source of truth for time-signature classification.
- Candidate collection may still use text/path decoding, but numeric candidates only become `TimeSig` after stacked-pair confirmation.
- Timeline extraction should consume only confirmed time-signature items and require at least two numeric tokens for numeric meters.
- Existing smoke tests that assert fragmented-four recognition must be rewritten to assert rejection instead.

**Success Criteria:**
- Ordinary numeric time signatures are detected only from confirmed stacked pairs.
- Fragmented-four geometric shapes do not become `highlight-timesig`.
- UI red warning accurately reflects missing time-signature recognition instead of being masked by geometric fallback.
- Focused smoke tests cover both acceptance and rejection behavior.
