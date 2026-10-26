# Disclosure summaries are plain text; the empty-state title is an h2

Chunk: R1
Status: fix under the parity policy (no prior approval needed); listed in the R1 PR

## Legacy behaviour

The Functional division, Domains and Networks sections wrapped an `<h3>` inside their `<summary>` (index.html:366, 397, 402, 407; `.evidence-section > summary h3 { font: inherit }` in detail.css). The empty state ("No region selected") was an `<h3>` with no heading above it in the panel (the panel's `h2#inspector-title` is `display: none`), so the outline jumped from the page title to level 3.

## New behaviour

Each summary is plain text, as the Constituents summary already was. The empty-state title is an `<h2>`, the level the region's name takes once one is selected, so the panel has the same heading level in both states. Nothing else changes visually.

## Standard

- ARIA 1.2: a `summary` in a `details` has the button role, and the children of a button are presentational, so an `h3` inside it is dropped or flattened by assistive technology and the heading outline is unreliable (WCAG 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value).
- GOV.UK Design System, Details: the summary is plain text, not a heading.
- WCAG 2.2 technique G141 and the heading-order guidance: do not skip levels in the outline.
