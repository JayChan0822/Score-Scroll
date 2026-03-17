# Boxed Rehearsal Marks Only Design

## Goal
Restrict rehearsal-mark detection to boxed uppercase labels so enclosed `A`-`Z` and two-letter boxed marks are recognized consistently regardless of vertical placement, while bare uppercase text is never promoted.

## Supported Forms
- One- or two-letter uppercase text matching `^[A-Z]{1,2}$`
- Text enclosed by a valid rehearsal-mark frame
- Frame geometry supplied by:
  - `rect`
  - `circle`
  - `ellipse`
  - rounded or custom frame `path`

This pass does not support bare uppercase text, digits, or mixed alphanumeric labels.

## Detection Strategy
Use enclosure-first promotion.

### Text candidates
- Accept only text nodes whose trimmed content matches `^[A-Z]{1,2}$`
- Exclude nodes already claimed by instrument-name or time-signature detection

### Boxed variants
- For each text candidate, look for the smallest valid enclosing shape using the existing enclosure geometry heuristic
- If a valid enclosure exists, promote the text and all shapes in the same enclosure group into `highlight-rehearsalmark`
- Do not require the text to map to a staff band
- Do not require proximity to a barline or the system start

### Bare variants
- If no valid enclosure exists, the text is not a rehearsal mark
- No fallback path remains for bare uppercase text

## Sticky Behavior
- Keep the existing `RehearsalMark` sticky lane
- Preserve grouped movement between the boxed text and its enclosure
- Do not alter sticky width compensation behavior

## Error Handling And Safety
- Keep the enclosure heuristic conservative so unrelated boxed annotations are not merged accidentally
- Favor false negatives over false positives when enclosure geometry is ambiguous
- Maintain the render-queue guard that drops rehearsal text lacking a valid frame

## Testing
- Add a focused regression fixture with boxed uppercase letters placed at mixed vertical offsets relative to staff bands
- Verify boxed letters are detected even when positioned above the previous `targetBand` window
- Verify bare uppercase text is not detected
- Verify boxed rehearsal marks still enter the sticky lane as `RehearsalMark`
