# The status line is in the page before it speaks

Chunk: X3
Status: fix (decision 40 on #4, bug 3); listed in the X3 PR

## Legacy behaviour

`#circuit-action-status` was `hidden` until it had text (circuits.js:146), so "Opening landmark…" and a failure arrived in a region that had just appeared, which assistive technology often does not announce.

## New behaviour

`CircuitStatus` renders a `role="status"` paragraph that is always mounted and empty at rest; empty it has no height, so it needs no `hidden`. Svelte writes its text only when the text changes. `{#key lang}` replaces the element on a language switch, so the sentence in force is inserted with its element and is not said again (decision 37).

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages; ARIA22 (role=status); MDN, ARIA live regions.
