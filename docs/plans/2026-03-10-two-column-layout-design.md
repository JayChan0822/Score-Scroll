# Two Column Layout Design

## Goal

Reorganize the page into a left-right workspace layout:

- left: score preview window
- right top: `Sources`
- right bottom: `Particle & Transport`

The layout should stay responsive and collapse back to a vertical stack on smaller screens.

## Recommended Approach

Use a dedicated workspace container rather than forcing the current DOM into CSS-only placement tricks.

Add a `workspace-layout` wrapper for the main area and a `control-stack` wrapper for the two right-side cards. Keep the existing cards and ids intact, and only reorganize their parent structure.

This keeps JavaScript bindings untouched and makes the layout easier to maintain.

## Desktop Layout

On desktop widths:

- `workspace-layout` becomes a two-column grid
- left column hosts the preview `stage-wrap`
- right column hosts a vertical `control-stack`
- `control-stack` contains the `Sources` card on top and `Particle & Transport` below

Recommended proportions:

- left column: `minmax(0, 1.6fr)`
- right column: `minmax(360px, 0.9fr)`

This keeps the preview visually dominant without squeezing the controls too hard.

## Mobile Layout

On smaller widths the layout should collapse to one column in this order:

1. preview window
2. `Sources`
3. `Particle & Transport`

This preserves usability on tablets and phones without special-case DOM logic.

## File Scope

Keep the change narrow:

- `index.html` for DOM regrouping and semantic class names
- `styles/layout.css` for the new grid and responsive behavior
- `styles/stage.css` only if the viewport sizing needs small adjustments

Do not change:

- control ids
- JavaScript event bindings
- export logic
- zoom logic

## Test Strategy

Add smoke coverage for both structure and layout behavior.

Structural checks:

- `workspace-layout` exists
- `control-stack` exists
- the right-side cards have explicit classes

Behavioral checks:

- on desktop width, the preview is left of both right-side cards
- on desktop width, `Sources` sits above `Particle & Transport`
- on mobile width, the three sections stack vertically in the expected order

The tests should stay relation-based rather than pixel-perfect.
