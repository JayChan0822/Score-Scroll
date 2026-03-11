# Shared Time Signature Decoding Design

## Goal

Support opening time signatures for non-MuseScore SVG imports through a shared `text + path` decoding pipeline, so both highlighting and timeline extraction use the same recognized result.

## Root Cause

Current time-signature handling is split:

- `identifyAndHighlightTimeSignatures()` in `scripts/app.js` primarily recognizes `text` candidates with a fixed regex plus MuseScore semantic `path.TimeSig`.
- `extractTimeSignatures()` in `scripts/features/timeline.js` only parses `RenderQueueItem`s where `symbolType === "TimeSig"` and `type === "text"`.

This creates two failure modes:

1. Non-MuseScore path-outlined time signatures are invisible to the highlighter because there is no path-signature decoder outside the MuseScore semantic class path.
2. Even if non-text time signatures were highlighted later, timeline extraction would still drop them because it only consumes text items.

## Options

1. Add a shared time-signature decoder and let both highlight classification and timeline extraction consume decoded tokens.
   Recommended. It fixes the architectural split and keeps decoding logic in one place.

2. Only add path support to the highlighter.
   This would make the UI look correct but leave `globalTimeSigs` incomplete. Playback display and downstream logic could still drift.

3. Keep extending regexes and font-specific text special cases.
   This helps some text exports but does nothing for path-outlined time signatures and keeps the split architecture.

## Chosen Design

Introduce a small shared decoder that can classify:

- text time-signature glyphs:
  - ASCII digits
  - supported PUA digit ranges
  - common time / cut time glyphs
- path time-signature glyphs:
  - path signatures keyed by normalized music-font name

The highlighter will collect both text and path candidates for non-MuseScore imports. It will continue to apply existing spatial filters:

- inside a staff band
- close to the start anchor or a physical barline
- stacked pair required for numeric signatures
- single glyph allowed for common/cut time

The render queue will preserve the decoded time-signature token so timeline extraction can parse both `text` and `path` items through the same token stream.

## Initial Font Coverage

The first path-signature set will target installed non-MuseScore fonts that are already in active use in this workspace:

- `Finale Ash`
- `Bravura`
- `Leland`
- `Petaluma`
- `Sebastian`

This is enough to prove the dual-channel architecture and cover the current Dorico/Finale-style examples. Additional fonts can be added incrementally without changing the pipeline.

## Verification

- Add a regression test proving `Finale Ash` opening PUA text time signatures still classify and still feed timeline extraction.
- Add a new non-MuseScore path-based fixture and assert both `highlight-timesig` and `globalTimeSigs` recognize it.
- Run targeted Playwright smoke tests.
- Run `npm run typecheck`.
- Run full `npx playwright test`.
