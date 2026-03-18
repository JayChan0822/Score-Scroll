# Source-Typed Analysis Profile Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten element analysis for Dorico, MuseScore, and Sibelius SVG imports so each source type only feeds high-confidence candidates into symbol detection.

**Architecture:** Add a centralized source-typed analysis profile that describes which semantic classes, path fonts, text fonts, and fallback paths are allowed per detector. Then update the existing detectors in `scripts/app.js` to gate candidates through that profile before symbol classification logic runs.

**Tech Stack:** Vanilla ES modules, SVG DOM analysis, Playwright smoke tests, font-family inheritance helpers.

---

### Task 1: Add failing source-typed gating regressions

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Create: `tests/fixtures/dorico-font-gated-symbols.svg`
- Create: `tests/fixtures/musescore-semantic-gated-symbols.svg`
- Create: `tests/fixtures/sibelius-text-gated-symbols.svg`
- Create if needed: `tests/fixtures/unknown-generic-symbols.svg`

**Step 1: Write the Dorico failing test**

Add a smoke regression that loads a Dorico-tagged fixture containing:

- one valid symbol path in the active Dorico font
- one lookalike symbol path in a different music font

Assert that only the active-font candidate is highlighted.

**Step 2: Run the Dorico test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "restricts Dorico symbol-path analysis to the active detected music font"`

Expected: FAIL because the current detector still admits cross-font path candidates.

**Step 3: Write the MuseScore failing test**

Add a smoke regression that loads a MuseScore fixture containing:

- class-tagged semantic candidates
- unclassed lookalike paths that would match the generic registry

Assert that the semantic candidates classify and the unclassed lookalikes stay unhighlighted.

**Step 4: Run the MuseScore test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "prefers MuseScore semantic candidates over generic path guessing"`

Expected: FAIL because the current detector still allows broad fallback competition.

**Step 5: Write the Sibelius failing test**

Add a smoke regression that loads a Sibelius fixture containing:

- valid symbol glyphs in `Opus Std` or `Opus Special Std`
- nearby non-symbol text in `Opus Text Std`

Assert that only the symbol-font text is analyzed as music symbols.

**Step 6: Run the Sibelius test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "restricts Sibelius symbol analysis to music-symbol fonts before fallback"`

Expected: FAIL because the current detector does not sharply separate Sibelius symbol fonts from text-domain fonts.

### Task 2: Add the shared analysis-profile scaffolding

**Files:**
- Create: `scripts/features/score-analysis-profile.js`
- Modify: `scripts/app.js`
- Modify if needed: `scripts/features/time-signature-decoder.js`

**Step 1: Create the profile builder**

Add a module that exports:

- `buildScoreAnalysisProfile({ sourceType, selectedMusicFont, svgRoot })`

The returned object should include:

- `sourceType`
- `selectedMusicFont`
- `allowedSemanticClasses`
- `allowedPathFonts`
- `allowedTextFonts`
- `allowGenericPathMatching`
- `allowAllFontFallback`
- `preferSemanticClasses`

**Step 2: Add helper predicates**

Implement shared helpers such as:

- `getScoreElementFontFamily(el, fallback)`
- `isAllowedPathCandidate(el, detectorName, profile)`
- `isAllowedTextCandidate(el, detectorName, profile)`
- `hasSemanticCandidates(svgRoot, detectorName, profile)`

**Step 3: Build the profile during SVG import**

In `scripts/app.js`, after source-type detection and font auto-detection settle, compute the current analysis profile and store it in runtime state or module-level state.

**Step 4: Run the targeted tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico|MuseScore|Sibelius"`

Expected: still FAIL, but now because detectors are not yet consuming the profile.

### Task 3: Tighten clef and time-signature candidate collection first

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Gate clef candidates through the profile**

Update `identifyAndHighlightClefs()` so:

- Dorico path candidates require an allowed active-font family
- MuseScore semantic `Clef` paths short-circuit generic path scanning when present
- Sibelius text candidates require allowed symbol fonts before generic fallback

**Step 2: Gate time-signature candidates through the profile**

Update `identifyAndHighlightTimeSignatures()` so:

- Dorico path/text candidates require allowed active-font families
- MuseScore `TimeSig` semantic paths take precedence and suppress unrelated generic path candidates when available
- Sibelius text candidates require symbol-font eligibility and exclude `Opus Text Std`

**Step 3: Run the focused tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "restricts Dorico symbol-path analysis to the active detected music font|prefers MuseScore semantic candidates over generic path guessing|restricts Sibelius symbol analysis to music-symbol fonts before fallback"`

Expected: PASS.

### Task 4: Tighten key-signature and accidental candidate collection

**Files:**
- Modify: `scripts/app.js`
- Create or modify: `tests/fixtures/*` for keysig/accidental edge cases
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Gate key-signature candidates**

Update `identifyAndHighlightKeySignatures()` so:

- Dorico only admits active-font symbol paths/text plus geometry-based natural clusters
- MuseScore prefers semantic `KeySig` candidates
- Sibelius prioritizes symbol-font text and rejects text-domain fonts

**Step 2: Gate accidental candidates**

Update `identifyAndHighlightAccidentals()` so the upstream candidate pool honors the same source-typed rules before graph classification runs.

**Step 3: Run focused regression coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico|MuseScore|Sibelius|accidental|keysig"`

Expected: PASS for the new focused regressions.

### Task 5: Tighten bracket and barline fallback policy

**Files:**
- Modify: `scripts/app.js`
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Preserve geometry-first rules for Dorico and Sibelius**

Keep `identifyAndHighlightInitialBarlines()` and `identifyAndHighlightGeometricBrackets()` geometry-based for Dorico and Sibelius.

**Step 2: Prefer semantic barline/bracket candidates for MuseScore**

Where semantic class presence is already strong, prevent generic fallback from competing unless semantic candidates are absent.

**Step 3: Run focused bracket/barline checks**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "MuseScore opening semantic classes|segmented MuseScore opening barlines|bracket"`

Expected: PASS.

### Task 6: Verify Unknown fallback and existing baseline behavior

**Files:**
- Modify: tests only if expectation cleanup is necessary

**Step 1: Verify Unknown fallback still works**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Unknown"`

Expected: PASS for the new unknown-source fallback coverage.

**Step 2: Verify existing vendor behavior**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "classifies imported score sources as Dorico MuseScore Sibelius or Unknown|shows the detected score source type in the sources card|classifies MuseScore opening semantic classes before signature guessing|preserves opening barlines, instrument names, and key signatures for transformed Opus SVG imports"`

Expected: PASS.

**Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 4: Remove temporary diagnostics**

Delete any temporary logging or fixture-only branches added during the gating work.
