# Focus inside the section row is handed to a tool that is still there

Chunk: G4
Status: fix (standard cited)

## Legacy behaviour

When the row is hidden while focus is inside it, `update()` calls `sectionTool.focus()` (ui/chrome/sections.js:433). The tract reference hides the row and the Section tool together (`data-anatomy-display`), so the call lands on a hidden button and focus falls to `<body>`. A row that folds its details behind More (compact) while focus is in them also drops focus to `<body>`.

## New behaviour

Before the row goes, focus inside it moves to the Section tool; when the tract reference is what hides the row, it moves to the dock's first tool (View), which the reference leaves. Close moves focus to the Section tool before the cut is closed, as legacy did. A row that folds its details while focus is inside them gives focus to More.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order (focus is not lost when the focused control is removed); WAI-ARIA APG practice that focus is never left on a removed or hidden element.
