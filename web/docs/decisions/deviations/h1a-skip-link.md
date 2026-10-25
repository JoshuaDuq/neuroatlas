# The skip link's target can take focus

Chunk: H1a (the link itself is H2's, see `h2-skip-link-without-script.md`)

## Legacy behaviour

The link targets `<main id="viewport">`, which cannot take focus, so activating it depends on its handler alone: without the handler the browser only scrolls.

## New behaviour

`<main id="viewport" tabindex="-1">`: the handler's fallback when no canvas can take focus (loading, error), and the target the anchor reaches without script. The masthead, which holds the link, is the first region in the document.

## Standard cited

WCAG 2.2 SC 2.4.1 Bypass Blocks (A), technique G1; GOV.UK Design System skip link (targets `main` with `tabindex="-1"`).
