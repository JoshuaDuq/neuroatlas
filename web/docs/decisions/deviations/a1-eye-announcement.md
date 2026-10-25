# Hiding or showing a part is announced

Chunk: A1
Status: fix, standard cited. Approved as decision 32 on #4.

## Legacy behaviour

Pressing an eye changes the dissection, the label of the focused button and, later, the count sentence ("N parts hidden") that is merged into the next unrelated announcement (`viewer/app.js:1670-1678`, `viewer/ui/panels/dissection.js:28`). Nothing says which part was hidden or shown when the button is pressed, and screen readers often do not re-read a focused button whose name changed.

## New behaviour

The eye announces through the page's one announcer, at once: "Hidden: {name}, {side}." / "Shown: {name}, {side}." (French "Masqué : …" / "Affiché : …"). The same applies to `V`. The count sentence stays with S1. The two strings are held in `VisibilityEye.svelte` until C1 adds them to the dissection area (requested on #4).

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages.
