# Glyph Font Fallback Design

**Problem**

`Broadway.svg` contains valid `path.TimeSig` glyphs but no `font-family` metadata. The current detector can classify those paths as time signatures in MuseScore SVGs, yet it does not decode their numeric token, so the timeline and on-screen meter display never receive the actual value.

**Root Cause**

- Path-based decoding depends on `font-family` normalization before consulting the music-font registry.
- MuseScore semantic `TimeSig` paths currently bypass path decoding and are only highlighted, leaving `data-time-sig-token` empty.
- Some registered fonts, including `Broadway`, are already present in the registry, but the code has no fallback path that infers the font from glyph signatures when metadata is absent.

**Chosen Design**

1. Add a shared glyph-signature font fallback for path-based music glyph decoding.
   - Build a reverse lookup from simplified SVG path signatures to candidate fonts, grouped by symbol category.
   - Resolve fonts in this order:
     1. explicit/inherited `font-family`
     2. SVG-level preferred font context
     3. glyph-signature fallback
   - When multiple fonts share the same signature, prefer the current SVG's already-resolved font, then the user-selected font, then stable registry order.

2. Make the fallback reusable across symbol families.
   - The shared helper should support `timeSignatures`, `clefs`, `accidentals`, `noteheads`, and future registry-backed path categories.
   - Existing time-signature decoding will use the helper first, but the API should be generic so other detectors can adopt it without re-implementing matching logic.

3. Decode MuseScore semantic `path.TimeSig` glyphs into tokens.
   - Keep the current semantic-class shortcut for candidate collection.
   - Before adding a candidate, simplify the path signature and resolve the font through explicit metadata or glyph fallback.
   - If decoding succeeds, store the token in `decodedToken` so `data-time-sig-token` is written and the timeline can read it later.

**Expected Result**

- `Broadway.svg` opening and mid-score path meters are highlighted and emit the correct numeric tokens without requiring `font-family`.
- The time-signature display updates from the decoded path tokens instead of staying empty or falling back incorrectly.
- The new fallback logic is shared infrastructure, ready for other path-based symbol detectors that encounter SVGs without embedded font metadata.

**Testing**

- Add a Playwright regression that loads `Broadway.svg`, waits for highlighted time signatures, and asserts both the highlighted tokens and displayed meter text.
- Add a focused unit-level regression for the shared fallback helper to confirm that a Broadway time-signature path signature resolves to the `Broadway` font without metadata.
