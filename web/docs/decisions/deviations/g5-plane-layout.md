# One plane fills one column

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

The phone layout shows one plane from 800 px of window width (and in short landscape), but the grid collapses to one column only at 700 px or less, so between 701 and 800 px (and in short landscape wider than 700 px) one plane sits in a third-width cell (dialogs.css:251-253 against render/device.js:13).

## New behaviour

The grid is one column whenever one plane is shown, because both rules use the same query.

## Standard cited

WCAG 2.2 SC 1.4.10 Reflow and SC 1.4.4 Resize Text (content sized to the viewport).
