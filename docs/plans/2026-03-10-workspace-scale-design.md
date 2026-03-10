# Workspace Scale Design

## Goal

Make the three-block work area visually match roughly `75%` browser zoom while keeping the header at its current size.

The work area must continue to preserve:

- desktop left/right layout
- equal-height preview and right control column
- existing auto-fit score behavior
- mobile stacked layout

## Recommended Approach

Apply a single visual scale to the workspace area only, instead of individually shrinking fonts, buttons, and spacing.

Use a dedicated wrapper outside `workspace-layout`:

- the wrapper keeps the normal document flow size
- `workspace-layout` itself gets `transform: scale(0.75)`
- the wrapper compensates for the reduced visual footprint so the page does not leave incorrect empty space

This approach keeps the layout logic and the rendering logic separate. The DOM still computes its original layout size, and only the final visual presentation is scaled down.

## Scope

Only the main three-block work area should shrink:

- preview viewport
- sources card
- particle and transport card

The header should not shrink.

## Layout Rules

Desktop behavior must remain:

- preview on the left
- sources and particle/transport stacked on the right
- preview height equal to the total right-column height

Mobile behavior must remain:

- preview first
- sources second
- particle/transport third

## Interaction With Auto-Fit

The existing preview auto-fit logic should keep reading the layout height from `viewportEl.clientHeight`.

Because the visual scaling happens at the workspace presentation layer, the preview layout box can still be measured consistently. This avoids rewriting the zoom math or the canvas rendering path.

## Test Strategy

Add a regression that checks:

- the new workspace scale wrapper exists
- desktop `workspace-layout` uses a `scale(0.75)` transform
- left/right layout still holds
- preview height still matches the right stack height
- the existing mobile stacking behavior still holds
