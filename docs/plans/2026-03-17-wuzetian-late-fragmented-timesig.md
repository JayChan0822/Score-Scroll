# Wu Zetian Late Fragmented Time Signature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recognize Wu Zetian's later fragmented `4/4` meter change so it enters the existing `TimeSig` highlight, timeline, and sticky pipelines.

**Architecture:** Keep the current time-signature detection flow. Extend the fragmented geometric `4/4` fallback so it can classify anchored later meter changes, not only the opening system-start case. Reuse existing `highlight-timesig` to `svg-analysis` behavior rather than adding special sticky-only logic.

**Tech Stack:** Vanilla JS, Playwright smoke tests, SVG DOM geometry analysis.

---

### Task 1: Add the failing Wu Zetian regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a regression that loads `武则天.svg`, finds the later `Pipa` lane meter change, and asserts:
- later `highlight-timesig` glyphs exist near the `Pipa` lane after the opening region
- `createSvgAnalysisFeature(...).buildRenderQueue(svg)` produces a later `time` block in the `Pipa` lane

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes Wu Zetian later fragmented time signatures for sticky lanes"`

Expected: FAIL because the later fragmented meter change is not highlighted and therefore no later sticky `time` block exists.

### Task 2: Generalize fragmented `4/4` fallback

**Files:**
- Modify: `scripts/app.js`

**Step 1: Write minimal implementation**

Refactor the opening-only fragmented `4/4` helper into a reusable helper that:
- groups horizontal `MLLLL` fragments and nearby vertical line fragments around candidate anchor columns
- can run for opening anchors and later barline anchors
- keeps current guardrails so isolated stems or unrelated symbols do not become time signatures

Then invoke it from `identifyAndHighlightTimeSignatures()` after the standard detection pass so later fragmented meters can be highlighted too.

**Step 2: Run the new regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "recognizes Wu Zetian later fragmented time signatures for sticky lanes"`

Expected: PASS

### Task 3: Re-verify existing time-signature behavior

**Files:**
- Modify: none

**Step 1: Run targeted regressions**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps geometric opening 4/4 recognition even when a later standard time signature is already classified|keeps local Wu Zetian opening fragmented 4/4 visible at the system start|recognizes Wu Zetian opening percussion clefs and fragmented opening time signatures|recognizes percussion time signatures for non-five-line staves|keeps opening time-signature offset isolated from later score time signatures|recognizes Wu Zetian later fragmented time signatures for sticky lanes"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-17-wuzetian-late-fragmented-timesig.md tests/score-scroll-smoke.spec.js scripts/app.js
git commit -m "fix: recognize late fragmented Wu Zetian time signatures"
```
