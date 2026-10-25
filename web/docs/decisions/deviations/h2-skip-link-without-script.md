# The skip link is rendered without script

Chunk: H2
Status: fix (standard cited)

## Legacy behaviour

The skip link is `hidden` in the markup until `createSettings` runs (header.js:191).

## New behaviour

It is rendered with the masthead; its `href="#viewport"` works on its own, and the click handler refines the target to the model's canvas.

## Standard cited

WCAG 2.2 SC 2.4.1 Bypass Blocks.
