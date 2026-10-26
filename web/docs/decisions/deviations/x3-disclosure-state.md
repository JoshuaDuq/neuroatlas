# The notes keep their open state across landmarks

Chunk: X3
Status: fix (decision 40 on #4, bug 8); listed in the X3 PR

## Legacy behaviour

Every step rebuilt `#circuit-notes` with new `<details>` elements (circuits.js:198-226), so a note the reader had opened closed when they pressed Next.

## New behaviour

The four notes are U4 `Disclosure`s whose `open` state lives in the panel. It is kept while the lesson moves between landmarks and starts closed again with the next lesson.

## Standard cited

HTML `<details>` state is the reader's; WAI-ARIA APG Disclosure pattern (the state belongs to the control, not to the content it shows).
