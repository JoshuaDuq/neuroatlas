# A refused full screen is said, not swallowed

Chunk: G6
Status: fix (standard cited); the string is approved in decision 33 on #4

## Legacy behaviour

`host.requestFullscreen?.().catch(err => console.error(...))` (viewport-chrome.js:627). If the browser refuses, the reader sees nothing happen and hears nothing; the optional call also hides a missing API.

## New behaviour

The call is direct. A rejection is logged and shown as a notice: "Could not enter full screen." / "Impossible de passer en plein écran." The string is `errors.operations.fullscreen` in i18n, shown through `failureNotice(error, lang, 'fullscreen')`.

## Standard cited

WCAG 2.2 SC 3.3.1 Error Identification and 4.1.3 Status Messages; CLAUDE.md (fail fast, no silent fallbacks).
