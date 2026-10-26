# A panel that hides at peek does not take focus with it

Chunk: H6

## Legacy behaviour

At peek `#navigator` and `#inspector` get `visibility: hidden` (phone.css:90-97). If a drag, a flick, the handle or a shell change lands the sheet on peek while focus is inside a panel, the focused control disappears and focus falls to `<body>`. Only selection updates call `rescueFocus` (app.js:549).

## New behaviour

Before the sheet settles on peek with focus inside a panel, focus moves to the handle, which is always on screen. A tab, the notice and the grip's own controls stay on screen at peek, so focus on them is left alone.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 2.4.7 Focus Visible; WAI-ARIA APG, "Managing focus": when the element that holds focus is hidden, focus moves to a logical place.
