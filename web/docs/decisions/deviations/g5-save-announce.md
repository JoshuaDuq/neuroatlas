# Saving a PNG is confirmed

Chunk: G5
Status: fix (decision 31 on #4)

## Legacy behaviour

Save PNG creates an anchor and clicks it; nothing tells an assistive-technology user that a file was handed to the browser (sections.js:308-312).

## New behaviour

Once the file is handed over, the polite announcer says "Saved the axial section as a PNG." (FR "Coupe axiale enregistrée au format PNG.").

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages. New strings are a `TODO(C1)` table in `features/sections/mpr-words.ts`.
