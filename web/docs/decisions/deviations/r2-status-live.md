# The status line is always mounted, busy is never above it, and the end of loading is said

Chunk: R2
Status: fix (decision 39, B2, B2b, B7); listed in the R2 PR

## Legacy behaviour

`p#comparison-status[role=status][hidden]` is shown and filled in the same paint (`atlas-comparison.js:121-123`), so its content arrives with the element and may not be announced. `aria-busy` sits on the `<details>` that contains the status line (`:124`), which asks assistive technology to hold back updates inside it. When loading finishes the text just clears, so nobody is told the content arrived.

## New behaviour

The status line (`StatusLine`, `role=status`) is rendered from the first paint, empty, and its text is written into the same node. `aria-busy` is on the content container only, never on an ancestor of the status line. A finished load says "Atlas comparison loaded." / "Comparaison des atlas chargée." (visually hidden, dropped at the next change), and a saved CSV says "Atlas comparison CSV downloaded." / "Fichier CSV de la comparaison des atlas téléchargé." through the page announcer. A language switch replaces the status node (`{#key lang}`) instead of rewriting its text, so it is not spoken again (decision 37).

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (technique ARIA22); WAI-ARIA 1.2 `role=status` and `aria-busy`; decision 33 on #4 (success announcement for a script-started file).
