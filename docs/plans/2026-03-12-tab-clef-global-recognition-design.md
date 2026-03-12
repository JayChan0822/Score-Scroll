# Tab Clef Global Recognition Design

**Goal:** Add TAB clef signatures for the supported desktop music fonts and let symbol recognition fall back across all registered fonts instead of only the currently selected one.

**Problem:** The registry does not currently include TAB clef signatures, so tablature clefs cannot be recognized at all. On top of that, `identifyClefOrBrace()` and `identifyAccidental()` still depend mostly on the selected music font, which makes mixed-font SVGs fragile when the imported score uses a different registered font for some symbols.

**Decision:** Add a single clef category named `Tab Clef (TAB谱号)` under each supported font and store the two provided sample styles as de-duplicated signature arrays. Keep the existing current-font-first lookup behavior, but replace the narrow Bravura-only fallback with a shared all-font fallback for clefs and accidentals.

**Approach:**
- Extend `scripts/data/music-font-registry.js` with `Tab Clef (TAB谱号)` entries for `Ash`, `Bravura`, `Broadway`, `Engraver`, `Golden Age`, `Jazz`, `Legacy`, `Leipzig`, `Leland`, `Maestro`, `Petaluma`, and `Sebastian`.
- De-duplicate same-font TAB signatures when both supplied samples collapse to the same drawing fingerprint.
- Build shared all-font lookup maps for `clefs` and `accidentals` alongside the existing global notehead map.
- Update runtime identification so `identifyClefOrBrace()` and `identifyAccidental()` try the selected font first, then fall back to the all-font maps.
- Leave path time-signature decoding unchanged because it already resolves through the element’s font family rather than the selected font dropdown.

**Testing:**
- Add a static registry regression that locks the `Tab Clef (TAB谱号)` signature sets for the 12 supplied fonts.
- Add a behavior regression that verifies a non-selected font’s clef, TAB clef, and accidental signatures are still recognized through the global fallback path.
