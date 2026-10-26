# A download started from the data bar is announced

Chunk: H3
Status: fix (standard cited)

## Legacy behaviour

Choosing an atlas, colour or internal anatomy that has to download says nothing: the progress lives only in the selected option's text ("Destrieux · Loading 34 %"), which a screen reader does not re-read, and completion is silent (header.js:321-326, 474-481).

## New behaviour

The start is announced through the polite live region as "<name>: Loading…" ("<name> : Chargement…" in French, with the French space before the colon), and the completion as "Anatomy loaded." / "Anatomie chargée." when the choice has landed. Progress is not announced per percent; it stays visible in the option text. A failure is already the notice, so nothing more is said. A choice that needs no download says nothing. Built from existing strings (`header.loading`, `viewport.loaded`); dedicated per-layer strings are requested from C1 on #4.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (AA).
