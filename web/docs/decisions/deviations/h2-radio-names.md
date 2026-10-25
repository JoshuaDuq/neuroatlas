# Radio names do not repeat the held bold width

Chunk: H2
Status: fix (standard cited)

## Legacy behaviour

The theme and single-key buttons hold their bold width with `::after { content: attr(data-label) }` (masthead.css:154-161). Generated content is part of the accessible name, so Chromium names them "System System".

## New behaviour

Each radio carries its visible text as its explicit name, so the hidden copy is not read.

## Standard cited

WCAG 2.2 SC 4.1.2 Name, Role, Value; accessible name computation (generated content is included when no aria-label is given).
