# A lost WebGL context is shown and can be retried

Chunk: T2
Status: fix (fix 12 (decision 41)); listed in the T2 PR

## Legacy behaviour

Neither the legacy dialog nor NiiVue (`dist/index.js` has no `webglcontextlost` handler) reacted to a context lost while the dialog was open: the canvas went blank with no message.

## New behaviour

A `webglcontextlost` listener on the live canvas shows the "could not be displayed" alert and disables the controls; Retry disposes the engine and starts a new one on a fresh canvas. The context that closing the dialog frees on purpose is not reported.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages and SC 3.3.1 Error Identification; WebGL's `webglcontextlost` event.
