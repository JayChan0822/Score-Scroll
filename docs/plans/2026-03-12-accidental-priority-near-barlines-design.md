# Accidental Priority Near Barlines Design

## Problem

Some mid-score accidentals sit close to both a trusted barline anchor and to nearby notes or accidental clusters. The current shared classification in `scripts/features/symbol-graph.mjs` gives these symbols no accidental seed if they miss the note-adjacent `dx` threshold by a fraction of a pixel, so they remain in the anchor-driven `keysig` prefix.

In `/Users/jaychan/Library/Mobile Documents/com~apple~CloudDocs/__Work_Projects__/__Dorico Projects__/20250518_登山/Scores/01 - Scroll - 登山 - 001.svg`, measure 46 piano lower staff exposes this exact failure:

- the target sharp is `dy ≈ 0` from the nearest notehead
- its `dx` is only slightly larger than the current seed threshold
- because it never becomes an accidental seed, contagion never starts
- the trusted barline window then keeps it as `highlight-keysig`

## Chosen Approach

Keep the current `trusted barline anchor + note-adjacent seed + contagion` model, but make the priority explicit:

1. If a candidate is clearly note-adjacent, it becomes an accidental seed even if it is also close to a barline.
2. If a candidate is close enough to an already infected accidental, contagion wins before key-signature preservation.
3. Only candidates that are neither seeded nor infected remain eligible for key-signature retention.

This preserves the current architecture and the trusted-anchor protection, while matching the intended musical priority.

## Rule Changes

### Note-adjacent seed

- Slightly relax the horizontal seed threshold so borderline cases like the Dengshan measure-46 sharp still seed when `dy` strongly indicates note attachment.
- Keep the existing vertical tolerance and band matching.

### Classification priority

- `seed accidental` and `contagion accidental` outrank `key signature`
- trusted anchors only classify the remaining non-infected candidates

## Non-Goals

- No changes to trusted barline anchor construction
- No changes to opening sticky or mask behavior
- No rewrite of the symbol graph architecture

## Validation

- Add a pure function regression proving a sharp near both a barline and a nearby note/accidental cluster classifies as accidental.
- Add a Dengshan smoke regression for measure 46 piano lower staff.
- Re-run the Changchengyao and Wu Zetian accidental/key-signature regressions to keep the current balance intact.
