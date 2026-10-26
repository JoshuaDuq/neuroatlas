# Closing the section is spoken

Chunk: G4
Status: fix (standard cited)

## Legacy behaviour

The section row's live region (`#cut-status`, index.html:535) sits inside `#section-bar`, which is `hidden` whenever no plane is cut (ui/chrome/sections.js:432-434). Closing the section writes "Full brain · no cut" into a region that has just stopped being rendered, so it is never announced. The same happens to a failure reported while the tract reference hides the row.

## New behaviour

The `role="status"` region belongs to the row's container, which stays mounted while the row's controls are removed. With no plane it draws nothing (visually hidden) but keeps speaking: closing the section says "Full brain · no cut" once. While a plane is cut it is the row's status line as before: the spoken sentence waits while a slider is dragged or the position slider has focus, and the shown line leaves out the position.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages: a status change must reach assistive technology without receiving focus, and a live region announces changes only while it is rendered.
