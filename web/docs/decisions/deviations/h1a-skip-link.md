# The skip link is present from the first paint and has a focusable target

Chunk: H1a

## Legacy behaviour

The "Skip to model" link is `hidden` until the settings menu is built (`header.js:191`), and its text is written only at the first `update()` (`header.js:201`), so during loading and on the pre-app error screen there is no way to bypass the masthead, and the text is English whatever the language. Its target, `<main id="viewport">`, cannot take focus, so the link depends on its handler.

## New behaviour

The link is rendered with the page, in the active language, and clipped until it has focus. It targets `<main id="viewport" tabindex="-1">`: activation moves focus to the 3D view when it can take it and to the main landmark otherwise (loading, error), and cancels the anchor's jump so the link state keeps its view.

## Standard cited

WCAG 2.2 SC 2.4.1 Bypass Blocks (A), technique G1; SC 3.1.2 Language of Parts; GOV.UK Design System skip link (first focusable element, visible on focus, targets `main` with `tabindex="-1"`).
