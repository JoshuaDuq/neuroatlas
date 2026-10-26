# M follows the single-key preference

Chunk: T2
Status: fix (D6 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:174-179` closed the dialog on `M` whatever the reader's single-key setting, and did not exclude a textarea or contenteditable target (only `input, select`).

## New behaviour

`M` closes the dialog only when single-key shortcuts are on, and not while the target is an input, select, textarea or contenteditable, or with Ctrl, Meta or Alt held. The close is instant, like the other keyboard closes.

## Standard cited

WCAG 2.2 SC 2.1.4 Character Key Shortcuts; the Linked MRI dialog does the same (`app.js:1888-1891`).
