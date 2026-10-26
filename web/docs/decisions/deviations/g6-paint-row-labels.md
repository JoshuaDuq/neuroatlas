# Every row of a paint key is named in the image

Chunk: G6
Status: fix (legacy bug); flagged on #4 because it changes what the image shows

## Legacy behaviour

The snapshot redraws each key from the DOM. It picks the words with `.stage-key-toggle > span…, [aria-pressed="true"], li > span:not(.network-swatch)` (viewport-chrome.js:688). The snapshot's first commit (7d01192) drew every row with `li > span:not(.network-swatch)`, which named every row of every key. Commit fdb13eb added the functional level's `aria-pressed` buttons. Commit 420c6ea then built the pickable paint rows by moving each row's `li > span` children into a `<button>`, and extended the selector with `.stage-key-toggle > span…, [aria-pressed="true"]` and the comment that says what it was for: "A key's words, title and the level shown included". It did not update `li > span`. But a paint row's label is now `li > button > span`, which `li > span` does not match. So a pickable paint key (the Functions overview, a deficit's findings) was drawn with its swatches and no names. The one picked row matched `[aria-pressed="true"]`, and its range started at the button's left edge, so its name was drawn over its swatch.

## New behaviour

What a key says comes from `keys.model()` (G3), so every row's label is drawn where it is on screen. The picked row is bold and the others muted, read from the computed style as on screen. The title, the functional level, the swatches, the plate and the rows clipped by scrolling are drawn as legacy drew them. The paint key's note is still not drawn (legacy; flagged on #4).

## Standard cited

Legacy's own contract: `drawKey` "redrawn from its on-screen plate: the plate, its swatches and its words" (snapshot.js:172), and the selector comment above. Also WCAG 2.2 SC 1.4.1 Use of Color as the design rule: a legend names its colours.
