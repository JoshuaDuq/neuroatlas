# Clearing the selection from the strip keeps focus on the page

Chunk: H5

## Legacy behaviour

workspace.js:257-260 clears, then checks at once whether focus is still on a visible control. The strip is hidden by the render that follows, so the check passes and focus then falls to the document (observed in the legacy build at 1280 px: `document.activeElement` is `body` after the click).

## New behaviour

After the clear command the workspace waits for the page to update and then, if focus was stranded, hands it to the tab in front.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA APG (when a focused control is removed, focus moves to a logical place).
