# The image is downloaded from a Blob, not a data URL

Chunk: G6
Status: fix (standard cited)

## Legacy behaviour

`canvas.toDataURL('image/png')` becomes the `href` of a download link (app.js:1451-1459). A Retina capture of a large stage is a base64 string of several megabytes, built on the main thread and held in the DOM.

## New behaviour

`canvas.toBlob(…, 'image/png')` (asynchronous encoding), then a link to `URL.createObjectURL(blob)`, revoked 40 s after the click, as FileSaver.js does. The PNG bytes, the file name `planum-<atlas>.png` and the click are unchanged.

## Standard cited

MDN, HTMLCanvasElement.toBlob() and URL.createObjectURL() (preferred over data URLs for generated downloads); FileSaver.js (the established download helper) for the revoke delay.
