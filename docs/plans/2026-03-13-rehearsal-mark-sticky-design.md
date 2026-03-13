# Rehearsal Mark Sticky Design

## Goal
Add sticky support for rehearsal marks so detected rehearsal letters stay pinned on the left and later marks replace earlier ones as playback progresses.

## Supported Forms
- Bare uppercase rehearsal text such as `A`, `B`, `AA`, `AB`, `AC`
- Rectangle enclosures
- Rounded-rectangle enclosures
- Circle enclosures

This pass does not support digits or mixed alphanumeric rehearsal labels.

## Detection Strategy
Use text-first detection rather than a music-font registry.

### Text candidates
- Accept only text nodes whose trimmed content matches `^[A-Z]{1,3}$`
- Exclude nodes already marked as instrument names, time signatures, or other sticky categories
- Require the text to sit above a staff band by a reasonable vertical margin

### Boxed variants
- For each valid text candidate, look for nearby enclosing geometry that fully wraps the text bounds
- Accept enclosure geometry from:
  - `rect`
  - `circle`
  - rounded-rectangle `path`
- If enclosure geometry is found, promote both the text and enclosure shapes into the same rehearsal-mark group

### Bare variants
- If no enclosure is found, still allow the text to be treated as a rehearsal mark
- Add a positional guard so bare text must be near the system start or near a real barline, which reduces false positives from other uppercase annotations

## Sticky Behavior
- Add a new `RehearsalMark` symbol type and a new sticky lane type alongside `inst / clef / key / time / bar / brace`
- Every detected rehearsal mark becomes its own sticky block within its lane
- When a later rehearsal mark reaches the sticky onset column, it replaces the earlier one
- Boxed rehearsal marks pin as a single unit, so the frame and text travel together
- Rehearsal marks do not participate in clef/key/time width compensation

## Error Handling And Safety
- Keep detection conservative for bare text to avoid turning ordinary uppercase words into rehearsal marks
- If enclosure geometry is ambiguous, prefer the bare-text interpretation rather than merging unrelated shapes into a block

## Testing
- Add minimal fixture coverage for:
  - rectangle rehearsal mark
  - rounded-rectangle rehearsal mark
  - circle rehearsal mark
  - bare `A` and `AA`
- Add sticky behavior coverage ensuring:
  - rehearsal marks are assigned a sticky type
  - framed marks keep text and frame in one block
  - later rehearsal marks replace earlier ones
  - ordinary uppercase text is not promoted incorrectly
