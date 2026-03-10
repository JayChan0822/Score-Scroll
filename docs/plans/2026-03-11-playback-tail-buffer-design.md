# Playback Tail Buffer Design

**Date:** 2026-03-11

## Goal

Give playback a consistent 2-second tail after the final mapped score event so the playline keeps moving briefly and audio does not stop abruptly.

## Context

Current playback ends when `renderFrame()` reaches the final `mapData.time`. At that moment the code immediately marks playback finished, snaps `smoothX` to the last map point, and pauses the audio element. This makes both the visual motion and audio end abruptly.

## Approved Direction

Use a unified tail-buffer model:

- Add a fixed playback tail buffer of `2` seconds.
- Treat total playback duration as `raw map duration + 2s`.
- Continue visual scrolling during the tail by extrapolating from the last segment velocity.
- Fade audio linearly from full volume to silence during the same 2-second tail window.
- Stop audio and mark playback finished only when the extended total duration is reached.
- Keep progress UI and default export end time aligned with the extended duration.
- Apply the same fade-out window to exported audio so exported media matches live playback.

## Implementation Notes

- Centralize the tail-buffer math in `scripts/features/playback.js`.
- Keep `scripts/app.js` responsible only for lifecycle decisions and UI updates.
- Reuse the extended total duration everywhere that currently depends on `getTotalDuration()`.
- Compute a reusable tail gain value so live playback and export can share the same fade envelope.

## Risks

- Export duration will also become 2 seconds longer by default. This is intentional for consistency.
- Tail extrapolation should remain linear and minimal; no new easing logic is needed.
