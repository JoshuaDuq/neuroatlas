# Hiding or showing a part is announced

Chunk: A1
Status: fix, standard cited. Approved as decision 32 on #4.

## Legacy behaviour

Pressing an eye changes the dissection and the label of the focused button, and the count sentence ("N parts hidden") is announced at once when nothing else is being said (`viewer/app.js:1676`, `dissectionSaid`). Nothing says which part was hidden or shown, and screen readers often do not re-read a focused button whose name changed.

## New behaviour

The part is named in the announcement: "Hidden: {name}, {side}." / "Shown: {name}, {side}." (French "Masqué : …" / "Affiché : …"), joined with the count sentence. The tree writes no sentence of its own: both would go to the page's one polite region in the same turn and the later would replace the first. Joining them is S1's (decisions 32 and 36 on #4; K2 follows): `VisibilityEye` only calls `onHide`/`onShow`, and the controller says the part with the count. The strings are C1's.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages.
