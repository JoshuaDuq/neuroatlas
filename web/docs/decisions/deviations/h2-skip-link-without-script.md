# The skip link exists from mount, in the active language

Chunk: H2
Status: fix (standard cited)

## Legacy behaviour

The skip link is `hidden` in the markup until `createSettings` runs (header.js:191), which happens after the anatomy index and the scene have loaded (app.js:103-139). Its text is English until the first update writes the active language (header.js:201).

## New behaviour

The link is rendered with the masthead, so it is the first Tab stop as soon as the page is shown, and its text is in the active language from the start. `href="#viewport"` is the fallback; the click handler hands focus to the model's canvas.

## Standard cited

WCAG 2.2 SC 2.4.1 Bypass Blocks; SC 3.1.1 Language of Page. Shares H1a's point on the language of first-paint text.
