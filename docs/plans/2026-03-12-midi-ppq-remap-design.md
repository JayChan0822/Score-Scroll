# MIDI PPQ Remap Design

## Goal

Make SVG-to-tick mapping independent of import order so that importing SVG before MIDI still rebuilds score ticks with the MIDI file's real PPQ before tempo projection runs.

## Root Cause

The score mapping pipeline currently bakes `svgTags.tick` during SVG import using whatever `globalMidiPpq` is at that moment. If SVG is imported first, that value is still the default `480`. When a later MIDI import sets `globalMidiPpq` to the real MIDI PPQ, `recalculateMidiTempoMap()` reuses stale ticks instead of rebuilding them, so the tempo table is applied to the wrong tick scale.

This is most visible with MIDI files whose PPQ differs from `480`, for example `960`.

## Recommended Fix

Keep MIDI parsing and tempo math unchanged. Instead, treat `svgTags.tick` as PPQ-dependent derived data and rebuild it whenever a MIDI import changes the active PPQ while an SVG is already loaded.

Implementation shape:

- introduce a small helper in `app.js` that rebuilds score mapping from the currently loaded SVG root
- call that helper from the MIDI import path before `recalculateMidiTempoMap()`
- keep the existing SVG import path using the same helper, so both import orders share one mapping entry point

## Why This Approach

- fixes the root cause instead of scaling stale ticks after the fact
- keeps the time-signature and barline mapping logic in one place
- makes `SVG -> MIDI` and `MIDI -> SVG` converge to the same `svgTags` and time map

## Testing

Add a regression that uploads:

- a minimal two-bar SVG
- a synthetic PPQ-960 MIDI with a tempo change after bar 1

Verify that:

- importing `SVG -> MIDI` produces the same total mapped duration as `MIDI -> SVG`
- the total duration matches the expected 8.00 seconds including the existing 2-second playback tail buffer
