# Themed WebGL failure screen

Chunk: H1b
Status: approved by the user on #4 (2026-10-25); widened to the loading and context-lost screens by decision 18

## Legacy behaviour

The WebGL capability failure screen (main.js:25-37 check, stage.css 286-310) is not themed. The stage is always the dark scene colour (`--scene-background`, overlay inks), and `createTheme` only runs inside `startApp()` (app.js:130), which never runs when the capability check or an early start error ends boot, so the failure is a dark box in a page that keeps the static light theme.

## New behaviour

The failure screen uses the page tokens (`--surface-base`, `--text-secondary`, `--danger`), so it follows light, dark, forced-colours and increased-contrast like the rest of the app. H1a's pre-paint head script supplies `data-theme` before any component runs. Decision 18 on #4 applies the same to the loading and context-lost screens, which share the stage.

## Standard cited

WCAG 2.2 SC 1.4.3 and 1.4.11; CSS `forced-colors` and `prefers-contrast` media features; `prefers-color-scheme`.
