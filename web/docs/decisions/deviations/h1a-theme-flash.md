# No light-theme flash before load

Chunk: H1a, U2
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

index.html:2 ships `data-theme="light"`; state/theme.js applies the stored or system theme only after the script loads, so a dark-theme user sees a light flash.

## New behaviour

An inline script in the head applies the stored or system theme to `<html data-theme>` before first paint, with the theme store's storage key and resolution.

## Standard cited

prefers-color-scheme (CSS Media Queries Level 5); WCAG 2.2 SC 1.4.3 Contrast (Minimum); established flash-free theming practice (web.dev).
