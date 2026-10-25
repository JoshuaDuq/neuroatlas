# A keyboard choice keeps the settings panel open

Chunk: H2
Status: fix (standard cited), decision 15 on #4

## Legacy behaviour

Any button click in the panel closes it and focuses the More settings button (header.js:126-131), so Enter or Space on a choice closes the panel.

## New behaviour

A pointer choice, and a command (Full screen, Provenance, Keyboard shortcuts), closes the panel and focuses the More settings button. A choice made with the arrow keys or Space leaves it open, so the user can keep walking the options and leaves with Escape or Tab.

## Standard cited

APG Radio Group (arrows move and select, so the next arrow must still find the group); WCAG 2.2 SC 3.2.2 On Input.
