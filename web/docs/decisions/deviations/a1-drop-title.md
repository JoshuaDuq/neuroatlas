# No native `title` on hidden rows

Chunk: A1
Status: fix, standard cited.

## Legacy behaviour

A hidden row sets `title` to the same text as its `aria-label` ("Name, side: reason. Activate to reveal."; `viewer/ui/panels/navigator.js:366-367`). A native `title` is a second, browser-drawn tooltip beside the one U5 draws for every other control, and it shows on mouse hover only.

## New behaviour

No `title`. A hidden row's name cell carries `data-tooltip` with the row's name ("Name, side: reason. Activate to reveal."), so U5's one tooltip shows the hint on hover and Escape dismisses it. U5 opens a tooltip from a row's descendant on hover only: a row takes focus, not the name cell, so the keyboard and screen reader hear the same text in the row's accessible name instead. The reason is also in the row's accessible name and, where it is the row's own, printed on the row. The eyes keep their own `data-tooltip`.

## Standard cited

Decision 32 on #4 (approved: drop `title`, show the reason in the U5 tooltip); U5's single tooltip (`lib/ui/Tooltip.svelte`).
