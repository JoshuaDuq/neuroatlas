# Full screen: visible exit and live labels

Chunk: G6, H2
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

viewport-chrome.js:626-632 toggles full screen with one button; in full screen the masthead is not shown, so no visible exit exists, and the button labels never change (header.js:202-209).

## New behaviour

An "Exit full screen" control inside the stage; every full-screen control's label and state follow the `fullscreenchange` event.

## Standard cited

WCAG 2.2 SC 2.1.2 No Keyboard Trap, 3.2.4 Consistent Identification, 4.1.2 Name, Role, Value; Fullscreen API `fullscreenchange`.
