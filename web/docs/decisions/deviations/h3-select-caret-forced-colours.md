# The select caret survives forced colours

Chunk: H3
Status: fix (standard cited)

## Legacy behaviour

The caret of every select is a `background-image` gradient (components.css:90-105). Forced colours removes background images, so the caret disappears and the select has no visible affordance (measured in Chromium with `forced-colors: active`: the select's `background-image` computes to `none`).

## New behaviour

The caret is two borders of a pseudo-element on a wrapper around each select. Forced colours keeps border colours and draws them in the system text colour, so the caret stays visible with no extra rule.

## Standard cited

WCAG 2.2 SC 1.4.11 Non-text Contrast (the control's indicator must be perceivable); CSS Color Adjust Module Level 1 (forced colours drops background images and keeps borders).
