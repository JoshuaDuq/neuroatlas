# A failed start is announced once, with the text shown

Chunk: H1b
Status: fix under the parity policy

## Legacy behaviour

When the model download fails, the live region is written twice: `app.js:185` writes the failure in the initial language, then `main.js:47` (`fail`) writes the final text (app.js:173-190). The two texts differ for an error that is not a download failure on a page opened from a link, so a screen reader speaks two different sentences. Capability errors reach only `main.js:47` and are announced once.

## New behaviour

`StageStatus` announces the start ("Loading anatomy…"), the end ("Anatomy loaded.") and a failure, once each, from the text it shows. Download progress is never announced. A lost context and its restore are announced by S1 (`speech.ts:49-53`), not here. The composition root does not announce these again.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (technique ARIA22).
