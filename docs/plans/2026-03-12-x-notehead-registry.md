# X Notehead Registry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Normalize existing notehead registry entries into quarter/half/whole/double-whole categories and add four duration-specific X notehead categories for the 12 provided desktop fonts.

**Architecture:** Keep the runtime unchanged and make this a registry-only data migration. Tests should lock the new notehead category structure first, then update the registry data to satisfy it.

**Tech Stack:** JavaScript registry data, Playwright smoke tests

---

### Task 1: Lock the new notehead registry structure

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add static assertions for:

- `Notehead_Quarter`, `Notehead_Half`, `Notehead_Whole`, `Notehead_DoubleWhole` on the desktop path fonts already in the registry
- `Notehead_X_Quarter`, `Notehead_X_Half`, `Notehead_X_Whole`, `Notehead_X_DoubleWhole` for the 12 provided X notehead SVG fonts

**Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js --grep "registers duration-specific standard notehead categories for the provided desktop fonts|registers duration-specific X notehead signatures for the provided desktop fonts"
```

Expected: FAIL because the registry still uses `Notehead_Solid` / `Notehead_Hollow` and has no X notehead entries.

### Task 2: Migrate the notehead registry data

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/scripts/data/music-font-registry.js`

**Step 1: Write the minimal implementation**

Update notehead data so that:

- existing standard noteheads use duration-specific category names
- X notehead categories are added for the 12 provided desktop fonts
- text-glyph fonts are normalized to the new quarter/half/whole names without inventing unsupported glyphs

**Step 2: Run test to verify it passes**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js --grep "registers duration-specific standard notehead categories for the provided desktop fonts|registers duration-specific X notehead signatures for the provided desktop fonts"
```

Expected: PASS

### Task 3: Verify notehead indexing still works

**Files:**
- Modify: `/Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js` if needed

**Step 1: Run relevant regression coverage**

Run:

```bash
npx playwright test tests/score-scroll-smoke.spec.js --grep "registers duration-specific standard notehead categories for the provided desktop fonts|registers duration-specific X notehead signatures for the provided desktop fonts|reclassifies the Violin II measure-21 flat in Dorico imports as an accidental|reclassifies Dengshan measure-46 piano-lower sharp as an accidental despite nearby barline anchors"
```

Expected: PASS

**Step 2: Commit**

```bash
git add /Users/jaychan/Documents/GitHub/Score-Scroll/scripts/data/music-font-registry.js /Users/jaychan/Documents/GitHub/Score-Scroll/tests/score-scroll-smoke.spec.js /Users/jaychan/Documents/GitHub/Score-Scroll/docs/plans/2026-03-12-x-notehead-registry-design.md /Users/jaychan/Documents/GitHub/Score-Scroll/docs/plans/2026-03-12-x-notehead-registry.md
git commit -m "feat: register duration-specific x noteheads"
```
