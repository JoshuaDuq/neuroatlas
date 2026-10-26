# Each Evidence summary names its association

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:187 gives every association a `<summary>` named "Evidence", so the controls list shows the same name once per association.

## New behaviour

The summary reads "Evidence" and carries a visually hidden ", {association title}" ("Données probantes, …" in French). The visible words begin the name.

## Standard cited

WCAG 2.2 SC 2.4.6 Headings and Labels, 2.5.3 Label in Name, 2.4.4.
