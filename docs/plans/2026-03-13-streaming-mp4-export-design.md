# Streaming MP4 Export Design

**Problem**

MP4 export currently uses `Mp4Muxer.ArrayBufferTarget()` with `fastStart: "in-memory"`, so the whole movie is assembled in browser RAM before download. Large exports fail at mux finalize with `RangeError: Array buffer allocation failed`.

**Chosen Direction**

Use the File System Access API when available:

- Prompt the user with `showSaveFilePicker()`
- Create a `FileSystemWritableFileStream`
- Hand that stream to `Mp4Muxer.FileSystemWritableFileStreamTarget`
- Finalize the muxer directly into the chosen file instead of building a giant in-memory `ArrayBuffer`

If that API is unavailable or the picker is not supported, keep the current download fallback so the feature still works in unsupported browsers.

**Behavior**

1. MP4 export prefers local-file streaming on supported desktop browsers.
2. Unsupported browsers, or environments without `showSaveFilePicker`, fall back to the current blob-download flow.
3. Picker cancellation should behave like a user cancellation, not an export crash.

**Why This Fix**

This removes the main memory bottleneck without changing the render/encode pipeline. It is the smallest change that makes long exports practical while keeping compatibility with the current browser-based app.
