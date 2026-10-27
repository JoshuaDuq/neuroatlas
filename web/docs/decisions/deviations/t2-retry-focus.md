# Retry keeps focus on the page

Chunk: T2
Status: fix (D8 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:72` hid the Retry button while it loaded, so focus fell to `<body>` and a keyboard user lost their place in the dialog.

## New behaviour

Pressing Retry first moves focus to the status area (`tabindex="-1"`), which stays mounted; Retry returns if the load fails again, and Tab continues from the status area.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; APG Dialog (Modal): focus stays inside the dialog.
