# Fragmented Meter Revival Design

**Problem:** The current strict stacked time-signature path only recognizes decoded text/path glyphs plus confirmed stacked numeric pairs. Dorico-style fragmented geometric opening and mid-score meters, including the large `4/4` seen in `武则天.svg`, are therefore rejected even when they are visually anchored exactly where a time signature belongs.

**Decision:** Restore fragmented meter recognition as a constrained fallback that runs after the standard time-signature pipeline. The fallback will only classify anchored fragmented meter clusters that sit inside legal staff bands and near trusted system-start or barline anchors, while preserving existing protections against noteheads, gliss markers, and other decorative fragments.

**Why This Approach:**
- It restores the user-visible behavior for Wu Zetian-style large meters without weakening normal numeric pair validation.
- It keeps `identifyAndHighlightTimeSignatures()` as the single entry point for time-signature highlighting.
- It limits risk by requiring staff-band legality, trusted anchors, and shape-specific cluster checks before any fragmented geometry is promoted to `highlight-timesig`.

**Alternatives Considered:**
- File-specific special casing for `武则天.svg`: low effort but brittle and not reusable.
- Reverting to the old global fragmented-four heuristic: broadest recovery but likely reintroduces the false positives the strict rewrite was meant to eliminate.

**Scope:**
- Restore fragmented geometric `4/4` recognition for opening and later anchored cases.
- Feed restored highlights into the existing timeline and sticky pipelines through normal `highlight-timesig` handling.
- Keep existing negative protections for nearby notehead pollution and non-meter geometric fragments.

**Out of Scope:**
- General recognition of arbitrary fragmented numeric meters beyond the revived constrained `4/4` path.
- Source-file-specific overrides.

**Detection Strategy:**
1. Run the existing standard time-signature detection unchanged.
2. Gather eligible staff bands and trusted anchors already computed in `identifyAndHighlightTimeSignatures()`.
3. Scan nearby geometric fragments for candidate top/bottom clusters that together match the known fragmented `4` silhouette and are vertically arranged like a legal `4/4`.
4. Reject candidates that overlap known false-positive zones, especially notehead-adjacent fragments and unrelated local shapes.
5. Promote accepted fragments to `highlight-timesig`, assign token metadata, and attach anchor X values so downstream sticky/timeline code continues to work unchanged.

**Testing Strategy:**
- Convert the current Wu Zetian opening rejection regression into an acceptance regression for fragmented opening `4/4`.
- Convert the current Wu Zetian later sticky-lane rejection regression into an acceptance regression for later fragmented `4/4`.
- Preserve or strengthen negative tests that prove nearby fragmented shapes do not classify when they are actually note-related geometry.

**Success Criteria:**
- `武则天.svg` opening large fragmented `4/4` becomes highlighted and visible to downstream consumers.
- Similar later fragmented meters also become highlighted and produce sticky `time` blocks.
- Existing non-fragmented stacked numeric behavior remains unchanged.
- Existing false-positive regressions around fragmented shapes remain green.
