# No native `title` on hidden rows

Chunk: A1
Status: fix, standard cited.

## Legacy behaviour

A hidden row sets `title` to the same text as its `aria-label` ("Name, side: reason. Activate to reveal."; `viewer/ui/panels/navigator.js:366-367`). A native `title` tooltip is shown on mouse hover only: not by keyboard focus, not on touch, not dismissible, and not hoverable.

## New behaviour

No `title`. The reason is in the row's accessible name and, where it is the row's own, printed on the row. The eyes keep their `data-tooltip`, which U5's tooltip shows on hover and on focus and dismisses with Escape.

## Standard cited

WCAG 2.2 SC 1.4.13 Content on Hover or Focus and SC 2.1.1 Keyboard.
