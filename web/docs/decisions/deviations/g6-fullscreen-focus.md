# Focus follows the stage into full screen and back

Chunk: G6
Status: fix (standard cited)

## Legacy behaviour

The Full screen button and the phone menu item are outside `#viewport`, the element that goes full screen. On entering, Chromium makes everything outside the full-screen element inert, so focus drops to the page. On leaving, nothing gives it back (viewport-chrome.js:625-631; nothing listens to `fullscreenchange`).

## New behaviour

Entering moves focus to the stage's "Exit full screen" control. Leaving returns focus to the control that asked for full screen when focus was on the exit control or nowhere. If that control is gone or disabled, focus goes to the stage (`#viewport`, tabindex -1). Focus on a stage tool that is still shown stays where it is.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 2.1.2 No Keyboard Trap; WAI-ARIA APG, "Keyboard interface: managing focus" (focus must not be lost when the focused element disappears).
