# 4K Pixel Budget Design

**Problem:** The export resolution control labels `3840` as `4K`, but non-`16:9` ratios currently treat that value as a direct width or height target. Ratios such as `4:3` and `3:4` therefore produce frames larger than standard UHD 4K pixel count, which can exceed WebCodecs H.264 encoder limits and crash export.

**Decision:** Keep the `4K` option visually and semantically close to UHD 4K, but constrain any `3840`-based export to the standard UHD pixel budget of `3840 x 2160 = 8,294,400` pixels. When a non-`16:9` ratio would exceed that budget, scale both dimensions down proportionally, preserve the requested aspect ratio, and keep width and height even.

**Why This Approach:**
- It preserves the user's expectation that `4K` means "roughly UHD 4K quality" instead of an arbitrary long-edge size.
- It fixes the encoder crash without forcing users to drop all the way to the `2560` preset.
- It keeps the ratio accurate because both dimensions are reduced by the same scale factor.

**Alternatives Considered:**
- Leave dimensions unchanged and only rely on encoder fallback: better than crashing immediately, but still fails on environments that cannot encode oversized H.264 frames at all.
- Clamp only the long edge or only the short edge: simpler, but produces inconsistent quality between landscape and portrait ratios.
- Apply the same pixel-budget rule to every export preset: more internally consistent, but changes behavior for `1080P` and `2K` presets that the user did not ask to adjust.

**Scope:**
- Constrain `3840` exports so total pixels never exceed UHD 4K budget.
- Preserve exact aspect ratio intent for `4:3`, `3:4`, and other custom ratios by scaling proportionally.
- Keep export dimensions encoder-safe by rounding to even numbers.
- Add regression coverage for the new sizing rule.

**Out of Scope:**
- Renaming the `4K` option in the UI.
- Changing `1080P` or `2K` sizing semantics.
- Adding codec-specific presets or exposing advanced encoder settings.

**Behavior Notes:**
- `16:9` remains `3840x2160`.
- `4:3` becomes approximately `3324x2494`.
- `3:4` becomes approximately `2494x3324`.
- `auto` exports at the `4K` preset also scale down if their computed frame would exceed the UHD budget.

**Testing Strategy:**
- Add a failing regression test for `computeSharedExportDimensions` proving `3840 + 4:3` and `3840 + 3:4` stay within the UHD 4K pixel budget.
- Re-run adjacent MP4 export tests to ensure the encoder fallback still behaves correctly.

**Success Criteria:**
- `4K` exports with `4:3` and `3:4` no longer exceed UHD 4K pixel count.
- Those exports remain visually close to 4K quality.
- Existing `16:9` 4K export dimensions stay unchanged.
