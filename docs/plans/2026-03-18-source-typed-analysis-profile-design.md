# Source-Typed Analysis Profile Design

## Context

The app now classifies imported SVG scores as `MuseScore`, `Dorico`, `Sibelius`, or `Unknown`. That classification is currently used only for a small set of behavior branches, most notably the MuseScore semantic-class path.

The deeper element-analysis pipeline is still mostly shared across all vendors:

- paths are scanned broadly against the music-font signature registry
- text nodes are scanned broadly for symbol content
- geometric line and polyline passes remain mostly vendor-agnostic
- fallback logic often crosses font families and exporter styles

That broad pipeline improves recall, but it also leaves precision on the table. The user wants the opposite trade-off for these three known score types:

- prefer strong, vendor-native signals
- reduce cross-vendor guesswork
- narrow candidate pools before symbol classification

This is especially important because Dorico, MuseScore, and Sibelius exports differ structurally:

- Dorico is path-heavy and strongly font-driven
- MuseScore exposes semantic classes directly on geometry
- Sibelius frequently encodes symbols as text glyphs in Sibelius-specific fonts

The current detector often handles those formats correctly, but it does so through mixed heuristics instead of an explicit “analysis profile” per source type.

## Goal

Introduce a source-typed analysis profile that narrows which SVG elements each detector is allowed to inspect, with a precision-first bias:

- Dorico: trust only current-font symbol paths and matching-font symbol text
- MuseScore: trust semantic classes first and sharply reduce generic path guessing
- Sibelius: trust symbol text in Sibelius music fonts first and sharply reduce broad path matching
- Unknown: keep the current balanced fallback path

The design should reduce false positives without removing validated vendor-native behaviors.

## Non-Goals

- Rewriting every detector into separate vendor modules in one step
- Removing all fallback logic immediately
- Changing timeline, sticky, or render-queue architecture
- Solving unrelated detection regressions unless directly exposed by the new gating

## Options Considered

### Option 1: Add vendor-specific `if/else` checks inside every detector

Pros:

- Fastest path to code changes
- Requires no new abstraction

Cons:

- Logic becomes scattered across `scripts/app.js`
- Hard to reason about candidate eligibility consistently
- Future tuning becomes repetitive and fragile

### Option 2: Build a centralized analysis profile and make detectors consume it

Pros:

- One place defines what each source type is allowed to analyze
- Keeps vendor rules explicit and consistent
- Lets detectors stay mostly unchanged after candidate gating

Cons:

- Requires a small abstraction layer before detector changes
- Initial refactor touches multiple detectors

### Option 3: Keep current broad candidate collection and only add confidence scoring

Pros:

- Least disruptive to existing code flow
- Retains maximum recall

Cons:

- Does not truly “tighten” analysis
- Leaves false positives in play longer than necessary
- Conflicts with the requested precision-first goal

## Decision

Use Option 2.

Add a centralized `analysisProfile` derived from `sourceType` plus detected/selected music font, and make detectors consult that profile before collecting candidates.

## Design

### 1. Analysis profile as the single gating source

Add a small helper module, for example:

- `scripts/features/score-analysis-profile.js`

It should export a function like:

- `buildScoreAnalysisProfile({ sourceType, selectedMusicFont, svgRoot })`

The returned profile should describe:

- allowed semantic classes by detector
- allowed path font families
- allowed text font families
- whether generic path-signature matching is allowed
- whether all-font fallback maps are allowed
- whether generic text-symbol scanning is allowed
- whether semantic-class detection should short-circuit the generic path pass

This should be treated as the single gating layer for symbol collection.

### 2. Dorico profile

Dorico should be the strictest font-bound path workflow.

#### Primary trust signals

- `<desc>` containing `Dorico`
- currently selected or auto-detected Dorico music font, typically `Bravura` or `Sebastian`
- geometric lines and polylines for staff lines, barlines, and brackets

#### Gating rules

- Path-based symbol detectors should only inspect paths whose inherited `font-family` resolves to the active detected music font, or to a narrow allowlist equivalent to that active font.
- Text-based symbol detectors should only inspect text nodes whose inherited `font-family` matches that same active music font when the text is intended to represent music symbols.
- Global all-font signature fallback should be disabled by default.
- Generic cross-font path matching should be disabled by default.
- Geometry detectors remain enabled because Dorico uses clean line/polyline structure for staff lines, barlines, and many bracket/barline layouts.

#### Practical effect

For Dorico, the detector stops treating every symbol-like path as potentially belonging to any registered font. Instead, it assumes the export is internally coherent and trusts only the currently identified Dorico font family for symbol paths.

### 3. MuseScore profile

MuseScore should be semantic-class-first and class-bounded.

#### Primary trust signals

- `<desc>` containing `Generated by MuseScore`
- semantic classes such as `Clef`, `KeySig`, `TimeSig`, `Bracket`, `BarLine`, and potentially `Accidental`

#### Gating rules

- When semantic classes exist for a detector, only class-matched elements should enter that detector’s primary candidate set.
- Generic path-signature scanning should not inspect unrelated unclassed paths if a semantic-class path set already exists for that detector.
- Font-based path guessing should be retained only as a narrow fallback when a semantic class exists but token decoding still needs a font hint.
- Text-based symbol scanning should be secondary and should not compete with class-tagged geometry for the same opening symbols.
- Geometry fallback remains valid for barline and bracket structures only when the expected semantic classes are absent.

#### Practical effect

For MuseScore, semantic classes become the contract, not just a hint. This avoids broad path-registry guessing on exports that already say what a symbol is.

### 4. Sibelius profile

Sibelius should be text-font-first, with explicit separation between symbol fonts and text fonts.

#### Primary trust signals

- Sibelius-family symbol fonts: `Opus Std`, `Opus Special Std`, `Helsinki`, `Inkpen2`
- Sibelius-family text fonts: `Opus Text Std`
- Qt-style export structure

#### Gating rules

- Clef, brace, accidental, and time-signature text scanning should primarily inspect `text` and `tspan` nodes whose inherited font belongs to the Sibelius symbol-font set.
- `Opus Text Std` should be treated as a text-domain font, not as a music-symbol font.
- Generic path-signature scanning should be heavily reduced or disabled by default for Sibelius symbol detectors, because the export’s strongest signal is usually text glyphs rather than arbitrary paths.
- Geometry detectors remain enabled for staff lines and barlines.
- A very narrow path fallback may remain for explicitly validated edge cases, but should not run as the default first pass.

#### Practical effect

For Sibelius, the detector should stop letting generic path heuristics compete with clearly encoded text glyphs in Sibelius symbol fonts. This also reduces the risk of accidentally promoting labels or text-domain glyphs.

### 5. Unknown profile

`Unknown` should preserve the current broad-but-balanced behavior:

- keep generic path-signature matching
- keep text scanning
- keep geometry passes
- keep conservative existing fallbacks

This avoids regressing unsupported but partially compatible exporters.

### 6. Detector-specific consequences

The following detectors should consume the profile:

- `identifyAndHighlightClefs()`
- `identifyAndHighlightInitialBarlines()`
- `identifyAndHighlightGeometricBrackets()`
- `identifyAndHighlightKeySignatures()`
- `identifyAndHighlightTimeSignatures()`
- `identifyAndHighlightAccidentals()`

#### Clefs

- Dorico: path-only when font matches active music font; matching-font text only as secondary
- MuseScore: class-first `path.Clef`; generic path pass only fallback
- Sibelius: text-first in symbol fonts; path pass minimized

#### Key signatures and accidentals

- Dorico: only active-font symbol paths/text should seed candidates
- MuseScore: `KeySig` and `Accidental` semantic classes should bound candidate sets where available
- Sibelius: symbol-font text should seed candidates; path pass minimized

#### Time signatures

- Dorico: only active-font path/text candidates should be allowed into the stacked-pair and anchor pipeline
- MuseScore: `TimeSig` class paths should be the primary set; generic path guesses should not compete when class paths exist
- Sibelius: symbol-font text should be primary; `Opus Text Std` text must not enter music-symbol time-signature detection

#### Barlines and brackets

- Dorico and Sibelius: keep geometry-first
- MuseScore: prefer `BarLine` and `Bracket` semantic classes, then geometry fallback if absent

### 7. Candidate-gating helpers

To keep detectors readable, add shared helpers such as:

- `getScoreElementFontFamily(el, fallback)`
- `isAllowedPathCandidate(el, detectorName, analysisProfile)`
- `isAllowedTextCandidate(el, detectorName, analysisProfile)`
- `hasSemanticCandidates(svgRoot, detectorName, analysisProfile)`

These helpers should handle vendor rules centrally instead of repeating them in each detector.

### 8. Fallback policy

The most important design rule is:

- fallback should become source-profile-aware, not globally available

Examples:

- Dorico should not use all-font path fallback unless explicitly re-enabled for a validated regression
- MuseScore should not fall through to broad unclassed path scanning when semantic candidates exist
- Sibelius should not treat all text fonts as eligible music-symbol carriers

## Testing Strategy

The implementation should be protected by source-specific regression fixtures:

### Dorico

Fixture should prove:

- a valid active-font symbol path still classifies
- a lookalike path in a different font does not enter the candidate set

### MuseScore

Fixture should prove:

- semantic class candidates classify correctly
- unclassed lookalike paths are ignored when class-tagged elements exist for that detector

### Sibelius

Fixture should prove:

- `Opus Std` or `Opus Special Std` text glyphs still classify
- `Opus Text Std` text does not leak into music-symbol detection
- broad path fallback does not reintroduce the rejected candidate

### Unknown

Fixture should prove:

- the generic fallback path still works for a minimal non-vendor SVG

## Migration Plan

Apply the tightening in stages:

1. introduce the analysis profile and no-op defaults
2. gate one detector family at a time, starting with clefs and time signatures
3. extend gating to key signatures and accidentals
4. then tighten barline/bracket fallback only where source-typed confidence is strong

This order limits regression scope and keeps failures local.
