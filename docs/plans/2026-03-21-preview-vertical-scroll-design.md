# Preview Vertical Scroll Design

## Goal
When the zoomed score becomes taller than the preview viewport, show a vertical scrollbar on the right side of the preview and allow mouse-wheel scrolling inside the preview without affecting the page.

## Current Constraint
- `#viewport` is both the fixed preview frame and the direct canvas host.
- `#viewport` currently uses `overflow: hidden`, so tall content has no independent scroll channel.
- The canvas resize logic always matches the viewport's visible height, so there is no distinction between visible preview height and scrollable content height.

## Chosen Approach
- Keep `#viewport` as the fixed outer preview frame.
- Add an inner scroll container dedicated to vertical overflow.
- Move the canvas into that scroll container so the preview can keep a fixed viewport size while its rendered content becomes taller.
- Bind mouse-wheel scrolling only while the pointer is over the preview scroll container.

## Behavior
- No vertical overflow: no scrollbar, existing preview behavior stays unchanged.
- Vertical overflow: the preview shows a native vertical scrollbar on the right edge.
- Wheel over preview: scroll the preview vertically.
- Wheel outside preview: preserve normal page scrolling.
- Desktop and preview-focus mode should both respect the same overflow behavior.

## Rendering Notes
- The outer viewport continues to define the visible frame size.
- The inner scroll layer owns `scrollTop`.
- Canvas width should still match the visible frame width.
- Canvas height should be based on the larger of visible viewport height and rendered score content height so the scroller has real overflow to expose.

## Testing
- Add a smoke test proving a tall score becomes vertically scrollable after increasing zoom.
- Add a smoke test proving wheel input over the preview changes preview scroll position.
- Re-run preview sizing smoke coverage to confirm width/height sync still works.
