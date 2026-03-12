# SVG Local Text Font Loading Design

**Goal:** Make imported SVG text render with the user’s locally installed text fonts instead of silently falling back when the browser does not already know those font families.

**Problem:** The import pipeline preserves `font-family` strings from SVG text nodes, but the page never registers matching `@font-face` entries or proactively loads those families. As a result, canvas text such as `let ring` and tempo marks can render in a fallback font even though the original SVG names a custom local font like `Ounen-mouhitsu`.

**Decision:** Add a small runtime font-loader that scans imported SVG text families, injects `@font-face` rules using `src: local(...)`, and waits for `document.fonts.load()` before the first post-import render. Keep the existing text extraction and `ctx.fillText()` path unchanged.

**Approach:**
- Add a focused module at `scripts/features/svg-text-fonts.js` that:
  - extracts actual `font-family` values used by `text` and `tspan` nodes,
  - normalizes comma-delimited family lists and strips quotes,
  - filters out generic CSS families and known music-font registry families,
  - injects runtime `@font-face` rules under a dedicated `.svg-local-font-face` marker,
  - requests the filtered families through `document.fonts.load()`.
- Update `processSvgContent()` in `scripts/app.js` to:
  - remove old injected local-font styles before each import,
  - register the imported text fonts after extracted SVG `<style>` blocks are copied into the page,
  - await the local-font load attempts before triggering the first render pass.
- Keep failure behavior soft:
  - if a local font is missing on the machine, import continues and canvas falls back as it does today,
  - emit debug logging for attempted families so missing local fonts are visible during diagnosis.

**Testing:**
- Add a regression fixture with a text node that uses `font-family="Ounen-mouhitsu"`.
- Add a smoke test that uploads the fixture and asserts:
  - the page injects `.svg-local-font-face`,
  - the injected CSS contains `local("Ounen-mouhitsu")`.
- Add a runtime behavior test that monkeypatches `document.fonts.load`, uploads the same fixture, and verifies the app attempts to load `Ounen-mouhitsu` through the font API.
