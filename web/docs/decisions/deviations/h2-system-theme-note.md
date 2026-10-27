# The System theme note is always available

Chunk: H2
Status: fix (standard cited)

## Legacy behaviour

The only explanation of System is the `data-tooltip` on its button (header.js:222). It shows on hover or focus and vanishes on Escape, so a touch user, or a screen reader that does not read the tooltip, never gets it.

## New behaviour

The note is also a visually hidden element that the System radio references with `aria-describedby`; the tooltip stays for pointer and keyboard users.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions, 1.4.13 Content on Hover or Focus (a tooltip is not the only carrier of an instruction).
