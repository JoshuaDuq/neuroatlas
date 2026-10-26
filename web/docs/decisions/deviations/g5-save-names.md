# Save PNG is named by its plane

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

Three buttons are all named "Save PNG" (sections.js:308-312, translations `savePng`).

## New behaviour

The visible text stays "Save PNG"; the accessible name is "Save PNG, sagittal" (FR "Enregistrer PNG, sagittal"), so the name starts with the visible words and the three buttons differ.

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name, SC 2.4.6 Headings and Labels, SC 4.1.2. New strings are a `TODO(C1)` table in `features/sections/mpr-words.ts`.
