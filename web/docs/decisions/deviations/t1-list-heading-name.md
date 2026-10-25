# The list heading reads as one phrase

Chunk: T1
Status: fix (decision 42, B3); listed in the T1 PR

## Legacy behaviour

The caption was two adjacent spans, "Tract bundles" and the count, with no separator in the text, so the heading's name ran together ("Tract bundles22").

## New behaviour

A visually hidden ", " separates them, so the heading's name is "Tract bundles, 22" and a screen reader reads a pause.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships and SC 4.1.2 Name, Role, Value.
