# A detent change is announced

Chunk: H6
Status: approved on #4 (decision 20)

## Legacy behaviour

`sheet.js` makes no announcement. The handle's name swaps between "Expand panel" and "Collapse panel", which a screen reader does not reliably say after a press.

## New behaviour

A polite status message after the reader moves the sheet directly: the handle, or a drag or flick that lands on a different rest (one that springs back says nothing). EN "Panel collapsed", "Panel half open", "Panel fully open"; FR "Panneau replié", "Panneau à moitié ouvert", "Panneau entièrement ouvert".

Nothing is said after a resize or rotation, after the automatic lift to half when the phone shell is entered with focus in a panel, or when the sheet is raised with another action (the selection strip, a tab, a pick on the stage): those already speak, and a second message would replace the first in the page's one live region. The strings are `sheet.detent` in i18n.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages.
