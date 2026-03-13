# Staff-Kind Time Signature Detection Design

**Goal:** Restore time-signature detection for percussion staves of varying line counts and for tablature opening meters without reintroducing false positives from tablature fingering digits.

**Problem:** The current time-signature detector hard-codes eligible staff bands to `lineYs.length === 5`. That blocks valid percussion staves that use 1-4 lines, and it also blocks six-line tablature opening meters entirely. The earlier six-line fix prevented tablature fingering digits from being misread as time signatures, but it did so by excluding the whole staff type rather than distinguishing opening meters from in-measure fingering.

**Decision:** Replace the line-count-only eligibility rule with staff-kind-aware detection. Each staff band will be classified as `standard`, `percussion`, or `tablature`, and the time-signature detector will combine that staff kind with an anchor-window rule and a “before first event” rule.

**Approach:**
- Extend time-signature staff-band data in `scripts/app.js` to classify each band:
  - `standard` for ordinary notation staves,
  - `percussion` for staves associated with percussion clefs or percussion instrument names, regardless of line count,
  - `tablature` for six-line TAB systems associated with TAB clefs or tablature-style numeric content.
- Keep the existing candidate collection for text/path time-signature digits, but replace the hard-coded five-line filter with `staffKind` checks.
- Add an anchor-window rule:
  - meters are only legal near the system start or immediately after a trusted barline,
  - they must appear before the first musical event for that band in that local window.
- Define first-event handling by staff kind:
  - `standard` / `percussion`: noteheads, rests, clef changes, and other ordinary musical symbols count as the first event,
  - `tablature`: tablature fingering digits count as the first event and block later digits from becoming meters.
- Preserve stacked-number validation and legal meter-token validation so only plausible numerator/denominator pairs become `TimeSig`.

**Testing:**
- Add a regression fixture for a six-line TAB opening meter where `4/4` at the staff start must be recognized but later fingering digits must not.
- Add a regression for the provided percussion score so the percussion meter is recognized again.
- Keep the earlier tablature regression so in-measure fingering digits remain rejected.
