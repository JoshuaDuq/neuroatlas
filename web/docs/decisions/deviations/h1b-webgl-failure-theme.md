# Themed WebGL failure screen

Chunk: H1b
Status: approved by the user on #4 (2026-10-25): decision 3, and decision 18 for the loading screen

## Legacy behaviour

The WebGL capability failure screen (main.js:26-60, stage.css:292-310) is not themed. The stage is always the dark scene colour (`--scene-background`, overlay inks), and `createTheme` only runs inside `startApp()` (app.js:130), which never runs when the capability check or an early start error ends boot, so the failure is a dark box in a page that keeps the static light theme.

## New behaviour

The failure screen uses the page tokens (`--surface-base`, `--text-secondary`, `--danger`), so it follows light, dark, forced-colours and increased-contrast like the rest of the app. H1a's pre-paint head script supplies `data-theme` before any component runs. Decision 18 on #4 ("Decision 3 covers the loading screen as well as the failure screens") applies the same to the loading screen. The context-lost screen is not covered: it appears in a running app whose stage is dark in both themes, so it keeps legacy's dark scene colours.

## Standard cited

WCAG 2.2 SC 1.4.3 and 1.4.11; CSS `forced-colors` and `prefers-contrast` media features; `prefers-color-scheme`.
