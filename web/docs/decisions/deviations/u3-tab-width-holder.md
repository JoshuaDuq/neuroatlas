# The bold tab label's width is held without doubling the accessible name

Chunk: U3
Status: fix (no approval needed; parity policy of #4)

## Legacy behaviour

`.rail-tabs button::after { content: attr(data-label); height: 0; visibility: hidden; font-weight: 600 }` (components.css:420-426) reserves the width of the bold label so choosing a tab moves nothing. Chromium and Safari include generated `::after` content in the accessible name, so each tab is named "Anatomy Anatomy".

## New behaviour

The reserved width is a visually hidden bold copy in an `aria-hidden` element inside the tab. The layout is identical; the accessible name is the label once.

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name and SC 4.1.2 Name, Role, Value; Accessible Name and Description Computation 1.2: `aria-hidden` content is excluded from the name.
