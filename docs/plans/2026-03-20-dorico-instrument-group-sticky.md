# Dorico Instrument Group Sticky Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Dorico-only detection and sticky pinning for vertical instrument-group labels plus their matching opening brackets.

**Architecture:** Add one Dorico-only classification pass in `scripts/app.js` for vertical group labels, then assemble those labels with opening brace geometry into `instGroup` shared sticky groups inside `scripts/features/svg-analysis.js`. Reuse the existing shared-sticky activation flow so the composite groups pin without lane-specific behavior.

**Tech Stack:** Vanilla JS, SVG DOM inspection, Playwright, existing sticky shared-group analysis.

---

### Task 1: Add the failing Dorico group-label classification smoke test

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing test**

Add a smoke test using `path.resolve(__dirname, '..', '乐器组括号.svg')` that collects the classes for:

```js
['Woodwinds', 'Horn', 'Strings Solo', 'Strings Ensemble']
```

and asserts each matching text element:

```js
expect(classes).toContain('highlight-instgroup-label');
expect(classes).not.toContain('highlight-instname');
```

**Step 2: Run the focused test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico group-label classification"`
Expected: FAIL because the vertical group labels are currently unclassified or treated as generic opening text.

**Step 3: Commit the failing test**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: cover dorico instrument group labels"
```

### Task 2: Add the failing shared-group analysis regression

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Write the failing regression**

Add an analysis-oriented test that imports `createSvgAnalysisFeature`, loads `乐器组括号.svg`, and asserts:

```js
expect(groupState.woodwinds.groupId).toBeTruthy();
expect(groupState.woodwinds.groupId).toBe(groupState.woodwinds.braceGroupId);
expect(groupState.woodwinds.sharedLockDistance).toBeCloseTo(0, 5);
```

Repeat the same structure for the other three group labels to prove label text and brace elements share one `sharedStickyGroupId`.

**Step 2: Run the focused test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico instrument groups share one sticky group"`
Expected: FAIL because no `instGroup` shared groups exist yet.

**Step 3: Commit the failing regression**

```bash
git add tests/score-scroll-smoke.spec.js
git commit -m "test: cover dorico instrument group shared sticky"
```

### Task 3: Implement Dorico group-label classification

**Files:**
- Modify: `scripts/app.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Add a dedicated classifier**

Implement `identifyAndHighlightInstrumentGroupLabels()` in `scripts/app.js` that:

- exits early when the SVG is not Dorico,
- scans opening-gutter `text` nodes,
- rejects music glyphs, time signatures, and already-classified elements,
- checks the element CTM for near-90-degree rotation,
- requires the label column to sit left of the normal instrument-name column and left of the opening barline,
- adds `.highlight-instgroup-label` to qualifying group labels.

**Step 2: Call the new classifier in the opening-detection sequence**

Insert the call after `identifyAndHighlightGeometricBrackets()` and before `identifyAndHighlightInstrumentNames()`.

**Step 3: Prevent double classification**

Update normal instrument-name detection so `.highlight-instgroup-label` is skipped instead of being relabeled as `.highlight-instname`.

**Step 4: Run the focused classification test**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico group-label classification"`
Expected: PASS

**Step 5: Commit the classifier**

```bash
git add scripts/app.js tests/score-scroll-smoke.spec.js
git commit -m "feat: classify dorico instrument group labels"
```

### Task 4: Build `instGroup` shared sticky groups in SVG analysis

**Files:**
- Modify: `scripts/features/svg-analysis.js`
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Teach SVG analysis about the new label type**

Update `getSymbolType()` so `.highlight-instgroup-label` maps to a distinct symbol type such as `InstGroupLabel`.

**Step 2: Add a helper to register instrument-group shared sticky groups**

Create a helper near `registerSharedGiantTimeStickyGroups()` that:

- collects `InstGroupLabel` items in the opening gutter,
- collects opening `Brace` items that remain left of the normal instrument-name column,
- groups connected brace parts into candidate brace clusters,
- pairs each label with the nearest qualifying cluster whose Y span covers the label center,
- builds one `blocks` entry per instrument group,
- stamps label and brace items with:

```js
item.isSticky = true;
item.stickyType = 'instGroup';
item.sharedStickyGroupId = groupId;
item.sharedBlockIndex = 0;
item.sharedLockDistance = 0;
```

**Step 3: Merge the new shared groups into the analysis result**

Extend the final `Object.assign(globalStickySharedGroups, ...)` path so the new `instGroup` groups are returned alongside giant time groups.

**Step 4: Run the focused shared-group regression**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico instrument groups share one sticky group"`
Expected: PASS

**Step 5: Commit the analysis wiring**

```bash
git add scripts/features/svg-analysis.js tests/score-scroll-smoke.spec.js
git commit -m "feat: pin dorico instrument groups as shared stickies"
```

### Task 5: Verify opening sticky regressions

**Files:**
- Test: `tests/score-scroll-smoke.spec.js`

**Step 1: Run the focused Dorico coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "Dorico group-label classification|Dorico instrument groups share one sticky group"`
Expected: PASS

**Step 2: Re-run related opening sticky coverage**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "keeps split opening instrument labels sticky for Dorico imports|keeps Changchengyao opening bracket verticals as sticky brace items"`
Expected: PASS

**Step 3: Run the full smoke suite if the focused coverage is clean**

Run: `npx playwright test tests/score-scroll-smoke.spec.js`
Expected: PASS

**Step 4: Commit the verification checkpoint**

```bash
git add tests/score-scroll-smoke.spec.js scripts/app.js scripts/features/svg-analysis.js
git commit -m "test: verify dorico instrument group sticky coverage"
```
