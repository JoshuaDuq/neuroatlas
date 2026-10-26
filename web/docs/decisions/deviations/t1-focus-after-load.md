# Focus does not fall to the page after a load or a Retry

Chunk: T1
Status: fix (decision 42, B2); listed in the T1 PR

## Legacy behaviour

The panel remembered the focused element before a load and refocused it afterwards (`native-ui.js:178-192`), but the Retry button is hidden while a load runs, so after pressing it the remembered element was gone and focus stayed on `<body>`.

## New behaviour

After a load, if focus fell to the page (or onto a control the load disabled), it returns to the remembered element when that can take focus, else to Retry when a failure shows it again, else to the search field. A language switch or any other re-render moves nothing.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA APG, Developing a Keyboard Interface (managing focus when the focused element is removed).
