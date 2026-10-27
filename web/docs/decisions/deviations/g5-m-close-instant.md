# `M` closes the Linked MRI without the fade

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

`M` calls `mprDialog.close()` (app.js:1883-1895), which keeps whatever `data-instant` the opening left. After a pointer opening, `M` closed with the 120 ms fade; after a keyboard opening, instantly.

## New behaviour

`M` is a keyboard close and is always instant (`closeMpr` sets `instant`). Escape and the Close button already were, when keyboard-activated.

## Standard cited

The viewer's own rule that keyboard closes are immediate (viewer/ui/chrome/sections.test.js:76-86, "closes immediately from the keyboard and native Escape"); WCAG 2.2 SC 2.3.3 Animation from Interactions in spirit (no motion the reader did not ask for).
