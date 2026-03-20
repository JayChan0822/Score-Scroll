# LilyPond Clef/Time Signature Design

**Problem:** The app currently classifies imported SVGs as MuseScore, Dorico, Sibelius, or Unknown. LilyPond exports fall through to Unknown, which prevents source-specific tuning and makes path-based clef/time-signature matching brittle because LilyPond path commands often use `H`/`V` segments instead of the `L`-heavy signatures stored in the existing music-font registry.

**Goal:** Add a dedicated LilyPond source type and a LilyPond-specific clef/time-signature matching path that improves recognition without changing the behavior of the existing MuseScore, Dorico, Sibelius, and Unknown pipelines.

**Approach:**
- Detect LilyPond SVGs using export-specific structural markers that are already present in the sample file, especially `.ly:line:column` source links and the footer text `No rights reserved.`
- Add a LilyPond-specific path-signature normalization fallback for clef and time-signature path detection. The fallback should keep the current generic signature path first, then retry with a LilyPond-normalized signature that collapses `H`/`V` into `L` and curve-adjacent commands into the closest registry-compatible buckets.
- Keep the current staff-band, anchor, and sticky logic intact so LilyPond uses the same downstream geometry validation once a symbol candidate is recognized.

**Testing:**
- Add a source-detection regression that classifies a LilyPond fixture as `LilyPond`.
- Add a smoke regression with a LilyPond-styled fixture whose clef and stacked time-signature paths only match after LilyPond-specific signature normalization.
- Confirm existing source-detection coverage still passes for Dorico, MuseScore, Sibelius, and Unknown fixtures.
