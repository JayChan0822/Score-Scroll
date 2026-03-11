# Shared Time Signature Decoding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decode non-MuseScore opening time signatures from both text and path glyphs, and feed the same decoded result into highlighting and timeline extraction.

**Architecture:** Add a shared decoder for time-signature glyph tokens. `scripts/app.js` will use it to classify opening text and path candidates, while `scripts/features/svg-analysis.js` and `scripts/features/timeline.js` will preserve and parse the decoded token instead of assuming time signatures are always text.

**Tech Stack:** Browser SVG DOM analysis, Playwright smoke tests, static font-signature data, HarfBuzz-generated fixture assets.

---

### Task 1: Add failing regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Create: `tests/fixtures/path-time-signature.svg`
- Test: `tests/fixtures/no-opening-barline-single-staff.svg`

**Step 1: Write the failing tests**

Add one regression for the existing `Finale Ash` fixture asserting:

- the opening `` glyphs are highlighted as time signatures
- the parsed `globalTimeSigs` includes `4/4`

Add a second regression for a new non-MuseScore path-based fixture asserting:

- opening path glyphs receive `highlight-timesig`
- `globalTimeSigs[0]` parses to the expected numeric pair

**Step 2: Run tests to verify they fail**

Run:

`npx playwright test tests/score-scroll-smoke.spec.js -g "keeps Finale Ash opening time signatures decoded into the timeline"`

`npx playwright test tests/score-scroll-smoke.spec.js -g "decodes non-MuseScore path time signatures into the timeline"`

Expected: FAIL because the current pipeline does not preserve shared decoded tokens and does not support non-MuseScore path time signatures.

### Task 2: Add shared time-signature decoding data

**Files:**
- Modify: `scripts/data/music-font-registry.js`
- Optionally create: `scripts/features/time-signature-decoder.js`

**Step 1: Add token maps**

Add shared tables for:

- text digit/common/cut glyph decoding
- path signature decoding by normalized font name

Keep the initial path coverage focused on `Finale Ash`, `Bravura`, `Leland`, `Petaluma`, and `Sebastian`.

**Step 2: Keep the API minimal**

Expose helpers that can:

- normalize a font family to a known music-font family
- decode a text token to a time-signature symbol
- decode a path signature to a time-signature symbol

### Task 3: Wire the highlighter to the shared decoder

**Files:**
- Modify: `scripts/app.js`

**Step 1: Update candidate collection**

Teach `identifyAndHighlightTimeSignatures()` to collect non-MuseScore path candidates in addition to text candidates.

**Step 2: Reuse existing spatial rules**

Keep staff-band and opening-anchor/barline proximity checks. Numeric glyphs still require a stacked partner. Common/cut time can pass as a single decoded symbol.

**Step 3: Persist decoded tokens**

When a candidate is accepted, attach a decoded token that later pipeline stages can read without re-guessing from raw text only.

### Task 4: Wire svg analysis and timeline extraction

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Modify: `scripts/features/timeline.js`

**Step 1: Preserve decoded tokens in the render queue**

For `TimeSig` items, include the decoded token on both `text` and `path` queue items.

**Step 2: Parse shared tokens**

Update `extractTimeSignatures()` to group and decode from shared tokens instead of filtering down to `type === "text"`.

### Task 5: Verify

**Files:**
- Modify: none

**Step 1: Run targeted tests**

Run the two new Playwright regressions and confirm they pass.

**Step 2: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Run full smoke suite**

Run: `npx playwright test`

Expected: PASS.
