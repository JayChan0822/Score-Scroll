# Dengshan Bridge Line And Clef Lane Design

**Problem**

`01 - Scroll - 登山 - 001.svg` exposes two sticky rendering issues:

1. The masked bridge redraw paints extra horizontal lines above and below the `Piano` grand staff.
2. The `Timpani` opening bass clef is assigned into the wrong sticky context, so its pinned rendering does not behave like an isolated opening clef.

**Root Cause**

- Bridge redraw currently accepts any long horizontal `line/polyline` and stores it in `globalAbsoluteBridgeLineYs`. Short partial segments that are not real full-span staff lines survive into the redraw cache.
- Sticky lane construction only uses `globalAbsoluteStaffLineYs`, which are reduced to validated five-line staves. Single-line percussion lanes therefore have no dedicated lane and their clefs get attached to the nearest five-line lane.

**Chosen Design**

1. Build a raw horizontal-line cache first, then keep only full-span score-line candidates for bridge redraw.
   - Treat “full-span” as lines whose horizontal extent matches the dominant score-line envelope, not merely “length > 100”.
   - Preserve one-line percussion staff lines if they share that full-span envelope.
2. Build sticky lanes from the filtered bridge-line cache instead of five-line-only staff lines.
   - This gives single-line percussion staves their own lane anchors.
3. Keep clef blocks maximally isolated.
   - Clef items should start a new sticky block immediately rather than merging with nearby clefs.

**Expected Result**

- `Piano` bridge redraw shows only its 10 grand-staff lines, with no extra top/bottom lines.
- `Timpani` opening bass clef lives in its own lane and its own sticky block.
