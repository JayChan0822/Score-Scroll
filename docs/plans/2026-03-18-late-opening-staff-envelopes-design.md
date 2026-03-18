# Late-Opening Staff Envelopes Design

**Problem**

`蕾拉弦乐.svg` contains additional staff groups that start later in the score instead of at the global opening `x`.
The current staff-line pipeline keeps only horizontal rows whose `minX/maxX` match a single dominant score envelope, so these later-opening staff groups never enter `globalAbsoluteBridgeLineYs` or `globalAbsoluteStaffLineYs`.
Downstream barline validation in `scripts/app.js` therefore uses incomplete staff boundaries and rejects otherwise valid full-height barlines after measure 13.

**Root Cause**

- `scripts/features/svg-analysis.js` merges horizontal bridge-line segments, then filters the merged rows against one dominant `minX/maxX` envelope.
- In this score, the early full-span rows begin around `x=962`, while the later-opening rows begin around `x=16759`.
- Because the later-opening rows do not match the opening envelope, they are removed before five-line staff validation.
- `scripts/app.js` builds staff top/bottom ranges solely from `globalAbsoluteStaffLineYs`, so the missing late-opening rows prevent clustered barlines from aligning to the correct staff boundaries.

**Chosen Design**

1. Replace single-envelope filtering with multi-envelope clustering in `scripts/features/svg-analysis.js`.
   - Group merged horizontal bridge-line rows by similar `minX/maxX` pairs.
   - Validate each envelope cluster independently instead of assuming one dominant global span.
2. Keep only envelope clusters that can form valid five-line staff groups.
   - Reuse the existing gap-consistency staff validation logic per cluster.
   - This prevents decorative or incidental horizontal lines from entering the staff model.
3. Build the exported caches as the union of all valid staff-bearing envelope clusters.
   - `globalAbsoluteBridgeLineYs` should include bridge rows from every validated envelope cluster.
   - `globalAbsoluteStaffLineYs` should include the validated five-line rows from every validated envelope cluster.

**Expected Result**

- Later-opening staff groups in `蕾拉弦乐.svg` are preserved in the staff and bridge caches.
- Barline detection reuses the expanded staff boundary model without needing special-case logic in `scripts/app.js`.
- Existing dominant-envelope regressions remain protected because only clusters that pass five-line validation survive.
