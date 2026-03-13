# Streaming MP4 Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stream MP4 export directly into a user-chosen local file when the browser supports the File System Access API, while preserving the existing download fallback.

**Architecture:** Add a small export-target resolver in `export-video.js` that chooses between `FileSystemWritableFileStreamTarget` and the existing `ArrayBufferTarget`. Keep the render/encode pipeline unchanged; only swap the muxer target and final save path.

**Tech Stack:** Vanilla JS, WebCodecs, File System Access API, mp4-muxer, Playwright smoke tests.

---

### Task 1: Add failing regression for local-file streaming export

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `scripts/features/export-video.js`

**Step 1: Write the failing test**

Add a Playwright smoke test that:
- loads a tiny two-bar SVG
- stubs `showSaveFilePicker`
- stubs `Mp4Muxer`
- stubs `VideoEncoder` and `VideoFrame`
- clicks `Export MP4`
- asserts the muxer was constructed with `FileSystemWritableFileStreamTarget`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "prefers local file streaming targets for mp4 export when file system access is available"`

Expected: FAIL because export still uses `ArrayBufferTarget`.

**Step 3: Write minimal implementation**

Add a helper in `scripts/features/export-video.js` that resolves the MP4 target via `showSaveFilePicker()` and `FileSystemWritableFileStreamTarget`.

**Step 4: Run test to verify it passes**

Run the same command and confirm it passes.

### Task 2: Add failing regression for fallback download mode

**Files:**
- Modify: `tests/score-scroll-smoke.spec.js`
- Modify: `scripts/features/export-video.js`

**Step 1: Write the failing test**

Add a Playwright smoke test that:
- loads the tiny SVG
- removes `showSaveFilePicker`
- stubs `Mp4Muxer`
- clicks `Export MP4`
- asserts the muxer target falls back to `ArrayBufferTarget`

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "falls back to in-memory mp4 export when local file streaming is unavailable"`

Expected: FAIL until the explicit fallback path exists.

**Step 3: Write minimal implementation**

Keep the current blob-download path as the fallback and only use it when no writable file stream target is available.

**Step 4: Run test to verify it passes**

Run the same command and confirm it passes.

### Task 3: Verify targeted export behavior

**Files:**
- Modify: `index.html` if cache-busting is needed

**Step 1: Run focused verification**

Run: `npx playwright test tests/score-scroll-smoke.spec.js --grep "prefers local file streaming targets for mp4 export when file system access is available|falls back to in-memory mp4 export when local file streaming is unavailable"`

**Step 2: Confirm no temporary debug code remains**

Check that only the real export helpers and tests remain, with no console-only instrumentation.
