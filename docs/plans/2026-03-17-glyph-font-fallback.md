# Glyph Font Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decode path-based music glyphs even when SVGs omit `font-family`, and restore numeric time-signature tokens for MuseScore semantic `TimeSig` paths such as those in `Broadway.svg`.

**Architecture:** Add a shared registry-backed glyph-signature fallback that can infer the most likely music font for a path by symbol category. Wire that helper into time-signature path decoding first, including the MuseScore semantic branch, while keeping explicit `font-family` as the primary signal.

**Tech Stack:** Vanilla ES modules, SVG DOM/path signature matching, Playwright smoke tests.

---

### Task 1: Add a Broadway regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Use fixture: `Broadway.svg`

**Step 1: Write the failing test**

Add a regression that loads `Broadway.svg`, waits for highlighted `.highlight-timesig` paths, and asserts:

- at least one opening Broadway meter stack is highlighted
- the highlighted opening tokens are decoded as `4`
- the meter display reads `4/4`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "decodes Broadway MuseScore path time signatures without font-family metadata"`

Expected: FAIL because the highlighted paths do not carry `data-time-sig-token` and the display does not resolve from those paths.

### Task 2: Add shared glyph-font fallback coverage

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `scripts/features/time-signature-decoder.js`

**Step 1: Write the failing helper-level regression**

Add a focused browser-side regression that imports the shared decoder helper and asserts a known Broadway time-signature signature resolves to the `Broadway` font when no `font-family` is supplied.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "resolves Broadway from glyph signatures when path font metadata is missing"`

Expected: FAIL because there is no glyph-signature fallback resolver yet.

### Task 3: Implement the shared fallback

**Files:**
- Modify: `scripts/features/time-signature-decoder.js`

**Step 1: Build reverse lookup helpers**

Add shared lookup builders that map simplified path signatures to candidate fonts by registry category, using the existing `MusicFontRegistry`.

**Step 2: Add generic font resolution**

Expose a helper that:

- accepts `signature`, `category`, optional explicit font family, optional preferred font family, and optional current resolved SVG font
- returns the most likely registry font or `null`

**Step 3: Preserve explicit metadata precedence**

Keep `font-family` normalization as the first path, and only use glyph fallback when explicit metadata is missing or unrecognized.

**Step 4: Run the helper regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "resolves Broadway from glyph signatures when path font metadata is missing"`

Expected: PASS.

### Task 4: Decode MuseScore semantic path time signatures

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write minimal integration change**

In the MuseScore semantic `TimeSig` branch, simplify each path signature, resolve the font with the new shared fallback, decode the token, and carry that token into the candidate object.

**Step 2: Preserve existing geometric validation**

Do not relax any current staff-band, barline-anchor, or stacked-pair validation. Only supply the missing decoded token path.

**Step 3: Run the Broadway regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "decodes Broadway MuseScore path time signatures without font-family metadata"`

Expected: PASS.

### Task 5: Verify the affected baseline

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js` if assertion naming or grouping needs final cleanup

**Step 1: Run focused path time-signature verification**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "decodes Broadway MuseScore path time signatures without font-family metadata|decodes non-MuseScore path time signatures into the timeline|recognizes Wu Zetian opening percussion clefs and fragmented opening time signatures"`

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Remove temporary debug artifacts**

Delete any one-off debug code or temporary assertions added during investigation.
