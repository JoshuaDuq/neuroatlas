# Themed WebGL failure screen

Chunk: H1b
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

The WebGL capability failure screen (main.js:25-37 check, stage.css 286-310) is not themed.

## New behaviour

The failure screen uses the theme tokens, so it follows light, dark, forced-colours and increased-contrast like the rest of the app.

## Standard cited

WCAG 2.2 SC 1.4.3 and 1.4.11; CSS `forced-colors` and `prefers-contrast` media features.
