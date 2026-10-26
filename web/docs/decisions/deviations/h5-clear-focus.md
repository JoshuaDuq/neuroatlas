# Clearing the selection from the strip keeps focus on the page

Chunk: H5

## Legacy behaviour

workspace.js:257-260 clears, then checks whether focus is still on a visible control. Rendering is synchronous (`clearContext` → `select(null)` → `render()`, app.js:533-536, 1563-1566), so by the time the check runs the strip is already hidden and focus has dropped to `<body>`. `visible(document.body)` is true, so the rescue is skipped and focus stays on `body` (observed in the legacy build at 1280 px).

## New behaviour

After the clear command the workspace waits for the page to update and then, if focus is stranded (on `body` or on a hidden control), hands it to the tab in front.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA APG (when a focused control is removed, focus moves to a logical place).
