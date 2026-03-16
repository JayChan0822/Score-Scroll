# Non-Power-of-Two Time Signatures Design

## Goal

Restore stacked numeric meter recognition for valid imported signatures such as `5/6`, `9/10`, and `15/16` without weakening the existing protections against isolated digits, fingering numbers, or non-meter text.

## Observed Root Cause

The failure happens in `identifyAndHighlightTimeSignatures()` after tokens are already decoded from SVG text.

`getValidStackedTimeSignaturePair()` accepts any positive integer numerator, but it only allows denominators from a hardcoded power-of-two whitelist. That rejects real imported meters with denominators like `6` and `10` even when their glyphs are correctly stacked and anchored near the system start.

The downstream timeline parser already accepts any positive integer pair once a candidate survives highlighting, so the bug is isolated to the stacked-pair legality gate rather than token decoding or timeline extraction.

## Recommended Approach

Apply the smallest behavior change that matches the actual data model already used elsewhere in the app.

1. Keep the existing stacked-pair geometry checks unchanged.
2. Keep the existing staff-band and anchor proximity checks unchanged.
3. Replace the denominator whitelist rule with a generic positive-integer validation for both numerator and denominator.
4. Add a regression that proves `5/6`, `9/10`, and `15/16` survive highlighting.

This keeps the anti-false-positive protections intact while removing the unsupported musical assumption that denominators must be powers of two.

## Detection Rules

### Stacked numeric time signatures

- The top and bottom glyphs must still form a vertically stacked pair with close X alignment.
- Both tokens must still decode as positive integers.
- The pair must still pass the current staff-band and system-start or barline-anchor checks.

### Rejected cases that must stay rejected

- isolated single digits with no stacked partner
- digits outside the allowed staff band
- digits too far from the system start or barline anchor
- tablature fingering digits that only happen to be numeric

## Test Strategy

Use a dedicated minimal fixture so the regression only contains the targeted stacked numeric meters and the required barline anchors.

Add one focused smoke regression that:

- loads the dedicated fixture
- waits for analysis to finish
- collects highlighted `TimeSig` tokens
- asserts the three targeted numeric pairs exist in highlighted output

That test should fail on the current whitelist-based logic and multi-digit pairing logic, then pass after the stacked-pair validation is corrected.
