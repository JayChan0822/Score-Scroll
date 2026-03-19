# Custom Export Ratio Design

**Problem:** The export ratio control only supports a fixed preset list. Users cannot enter a custom aspect ratio such as `3:2` or `21:9`, so both preview sizing and export output are limited to the built-in presets.

**Decision:** Add a dedicated `自定义比例` option beneath the existing ratio presets. Selecting it opens a modal where the user can enter a width:height ratio. After confirmation, the select stays on the custom option and its label changes to `自定义 (w:h)`, and the chosen ratio flows through preview sizing, export sizing, and persisted local settings.

**Why This Approach:**
- It matches the requested interaction exactly: choose custom from the list, then enter the ratio in a popup.
- It keeps the export card compact because the custom inputs appear only when needed.
- It reuses the app's existing `w:h` ratio pipeline instead of adding a second representation for aspect ratios.

**Alternatives Considered:**
- Permanent width and height inputs under the ratio select: simpler state model, but adds clutter to the export panel.
- Freeform inline text input next to the select: more compact than a modal, but harder to validate cleanly and less consistent with the requested interaction.

**Scope:**
- Add a `自定义比例` select option.
- Add a modal that accepts a ratio in `w:h` form and validates positive numeric width and height values.
- Preserve the selected custom ratio in the select label, local storage, preview sizing, and export flows.
- Revert gracefully if the user cancels custom-ratio entry.

**Out of Scope:**
- Arbitrary math expressions such as `1920/1080`.
- Separate width/height export size overrides beyond the existing base-resolution control.
- Multiple saved custom ratio presets.

**Interaction Design:**
1. The export ratio select gains a final option with value `custom`.
2. When the user selects that option, open a modal with one ratio text field and confirm/cancel buttons.
3. Accept input like `3:2`, normalize it to trimmed `w:h` text, and reject invalid or non-positive values.
4. On confirm:
   - store the normalized ratio string as the active custom ratio,
   - update the custom option label to `自定义 (w:h)`,
   - keep the select on the custom option,
   - refresh preview sizing and save local settings.
5. On cancel:
   - if a custom ratio already exists, keep that existing custom value selected,
   - otherwise restore the previous non-custom preset so the select never points at an unresolved custom state.

**Data Flow:**
- The select continues to expose preset values directly.
- A small resolver layer maps the UI state to the effective export ratio:
  - preset selection returns the preset string,
  - custom selection returns the stored custom ratio string,
  - unresolved custom selection falls back to the previous preset.
- Preview sizing in `scripts/app.js` and export dimension calculation in `scripts/features/export-video.js` both consume the resolved effective ratio instead of reading the raw select value blindly.
- Local storage saves both the select choice and the custom ratio string so reload restores the same state.

**Validation and Error Handling:**
- Require exactly two positive numeric parts separated by `:`.
- Reject `0`, negative, empty, or malformed input and show a short inline error in the modal.
- Keep the modal open on validation failure so the user can fix the value.
- Support Escape to close the modal and Enter to confirm.

**Testing Strategy:**
- Add structural tests proving the custom ratio option and modal DOM are present.
- Add a behavior test that injects a custom ratio, confirms it, and asserts the select label updates to `自定义 (3:2)`.
- Add a preview behavior test that checks desktop preview width changes when switching from a preset ratio to the custom `3:2` ratio while height stays aligned.
- Add a small source-level regression that ensures export dimension code resolves custom ratio strings before computing output.

**Success Criteria:**
- Users can choose `自定义比例`, enter a ratio, and immediately see the preview update.
- Video and PNG exports use the same custom ratio as the preview.
- Refreshing the page restores the custom ratio selection and label.
- Canceling custom entry does not leave the ratio select in a broken state.
