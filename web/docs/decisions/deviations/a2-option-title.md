# No native `title` on a result that is not on screen

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

A result that is hidden or unavailable sets `title` to the same text as its `aria-label` (`navigator.js:367`): a second, browser-drawn tooltip, on mouse hover only, beside the one U5 draws for every other control.

## New behaviour

No `title`. The row's drawn line carries `data-tooltip` with the row's name ("Name, side: reason. Activate to reveal."), so U5's one tooltip shows it on hover and Escape dismisses it. The reason is also printed on the row and in its accessible name, which keyboard and screen-reader users read from the armed option.

## Standard cited

WCAG 2.2 SC 1.4.13 Content on Hover or Focus; decision 32 on #4 (the same fix as the tree, `a1-drop-title.md`).
