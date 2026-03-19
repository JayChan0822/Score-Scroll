# Dorico Time Signature Cross-Font Matching Design

**Problem:** Some Dorico exports mix music fonts inside one SVG. In `武则天.svg`, the dominant music font is `Leland`, but the large opening and later time signatures are encoded as Bravura text glyphs such as `U+F444`. The current Dorico time-signature detector requires text/path candidates to use the dominant analysis font, so these valid time-signature glyphs are rejected before decoding.

**Decision:** Keep the dominant-font guardrails for non-time-signature detectors, but remove that guardrail from time-signature candidate collection only. For Dorico time signatures, accept any text/path candidate that can be decoded as a time-signature glyph by the shared decoder, regardless of whether its font matches the dominant analysis font.

**Why this approach:**
- It fixes the actual regression source: valid Bravura time signatures embedded in an otherwise Leland Dorico file.
- It limits blast radius by changing only the time-signature pipeline.
- It preserves existing staff-band, anchor, giant-meter, and stacked-pair validations after candidate collection.

**Scope:**
- Allow Dorico text time-signature candidates from any recognized music font.
- Allow Dorico path time-signature candidates from any recognized time-signature font/signature match.
- Do not relax font gating for clefs, noteheads, key signatures, or accidentals.
- Do not change downstream sticky/timeline parsing beyond restoring the missing highlights.

**Validation:**
- `武则天.svg` opening giant Bravura `4/4` glyphs highlight and feed the displayed time signature.
- Existing Wu Zetian later fragmented-meter rejection remains unchanged, because it is a separate non-font root cause.
- Existing Dorico numeric and giant-Bravura time-signature regressions stay green.
