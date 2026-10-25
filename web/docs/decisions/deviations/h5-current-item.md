# Workspace scroll-into-view selectors

Chunk: H5
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

viewer/ui/chrome/workspace.js:9-12 builds CURRENT_ITEM from `[aria-pressed="true"]` for function, deficit and circuit rows and from `#circuit-landmarks [aria-current="step"]`, but those rows mark the current item with `aria-current`, and `#circuit-landmarks` is a class, not an id. A list coming back into view does not show its current item.

## New behaviour

The selector targets the attribute and element each list really uses (`aria-current` on its rows; the landmarks container by its class), so the current item scrolls into view.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 2.4.11 Focus Not Obscured (the restored position must be visible); correct use of `aria-current` (WAI-ARIA 1.2).
