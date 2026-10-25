# Tooltip grace area

Chunk: U5
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

ui/tooltip.js closes a tooltip HIDE_DELAY = 150 ms after the pointer leaves, so the pointer can cross the gap to the tooltip.

## New behaviour

Bits' grace area keeps the tooltip open while the pointer travels to it. The 500 ms show delay and 300 ms skip window are kept.

## Standard cited

WCAG 2.2 SC 1.4.13 Content on Hover or Focus (hoverable, dismissible, persistent); APG Tooltip.
