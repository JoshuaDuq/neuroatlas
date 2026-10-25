# A failed start is announced once, with the text shown

Chunk: H1b
Status: fix under the parity policy

## Legacy behaviour

A failed start writes the polite live region twice, with texts that can differ: `app.js:185` writes the failure in the initial language, then `main.js:47` (`fail`) writes the final text. For a link failure or a capability error the second text differs, so a screen reader speaks two different sentences.

## New behaviour

`StageStatus` announces each transition once, from the text it shows: the start ("Loading anatomy…"), the end ("Anatomy loaded."), the failure, and the lost context. Download progress is never announced. The composition root does not announce these again.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (technique ARIA22).
