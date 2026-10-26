# A bundle that is not drawn has no description

Chunk: T1
Status: fix (decision 42, B6); listed in the T1 PR

## Legacy behaviour

Each key was described by its count and length summary (`aria-describedby`), and the description of a bundle that is loaded but not drawn was only clipped away (`visually-hidden`, `native-ui.js:98`): a screen reader still read "1 234 streamlines" for a bundle that is not on screen.

## New behaviour

The description element is rendered, and referenced, only while the bundle is drawn. Unchecking the key removes both.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships (what is conveyed programmatically matches what is shown).
