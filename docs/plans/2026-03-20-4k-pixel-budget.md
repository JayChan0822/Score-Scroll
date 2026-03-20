# 4K Pixel Budget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the `4K` export preset close to UHD quality while preventing non-`16:9` aspect ratios from exceeding standard 4K pixel budget and crashing MP4 export.

**Architecture:** Adjust shared export-dimension calculation so the `3840` preset applies a UHD pixel-budget cap after ratio sizing, then scale dimensions and export zoom proportionally. Cover the behavior with a focused regression test and re-run nearby MP4 export smoke tests.

**Tech Stack:** Browser ESM, WebCodecs, Playwright smoke tests

---

### Task 1: Add the failing sizing regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a browser-evaluated test that imports `computeSharedExportDimensions`, computes `3840 + 4:3` and `3840 + 3:4`, and asserts both results stay within `3840 * 2160` pixels while keeping `16:9` at `3840x2160`.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps 4k non-16:9 exports within the UHD pixel budget"`

Expected: FAIL because current `4:3` and `3:4` results exceed the pixel budget.

### Task 2: Implement the pixel-budget cap

**Files:**
- Modify: `scripts/features/export-video.js`

**Step 1: Write minimal implementation**

Update `computeSharedExportDimensions` so when `baseRes === 3840` and computed dimensions exceed UHD 4K pixel budget, both dimensions are scaled down proportionally, rounded to even numbers, and `finalExportZoom` is reduced by the same scale factor.

**Step 2: Run focused test to verify it passes**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps 4k non-16:9 exports within the UHD pixel budget"`

Expected: PASS

### Task 3: Re-run adjacent export regressions

**Files:**
- Modify: none

**Step 1: Run nearby MP4 export tests**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "prefers local file streaming targets for mp4 export when file system access is available|falls back to in-memory mp4 export when local file streaming is unavailable|falls back when the preferred 4k hardware encoder config is unsupported"`

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-20-4k-pixel-budget-design.md docs/plans/2026-03-20-4k-pixel-budget.md tests/score-scroll-smoke.spec.js scripts/features/export-video.js
git commit -m "fix: keep 4k export ratios within uhd budget"
```
