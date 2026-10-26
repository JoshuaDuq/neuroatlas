# The tract reference's name and description are reachable without a pointer

Chunk: H3 (decision 16 on #4)
Status: fix (standard cited)

## Legacy behaviour

The tract reference's name carries its description only as a hover tooltip on text that cannot take focus (header.js:522-523). Keyboard and screen-reader users cannot reach it, and touch users cannot hover. In the collapsed bar the reference has no popover, so no note is printed.

## New behaviour

When the name has a description it is a Tab stop, so the page's tooltip opens on keyboard focus (dismissible with Escape, hoverable, persistent), and it is described by the description text through `aria-describedby`, so a screen reader reads it with the name. Not solved: a sighted touch reader cannot open the tooltip, because touch does not show focus-visible tooltips. Flagged on #4 for a product decision, since printing the description in the bar is a design change.

## Standard cited

WCAG 2.2 SC 1.4.13 Content on Hover or Focus, SC 2.1.1 Keyboard; WAI-ARIA APG Tooltip (the trigger is focusable).
