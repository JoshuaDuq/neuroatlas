# Roving focus leaves modified arrow keys alone

Chunk: U2
Status: fix (no approval needed; parity policy of 2026-10-25 on #4)

## Legacy behaviour

ui/roving.js:48-56 moves focus and calls `preventDefault()` on any ArrowLeft/Right/Up/Down/Home/End `keydown` inside the group, whatever modifiers are held. Alt+ArrowLeft (browser Back) and Alt+ArrowRight (Forward) pressed on a focused toolbar button are swallowed, as are Ctrl/Cmd+Arrow and Shift+Arrow.

## New behaviour

`bindRoving` ignores a `keydown` with Alt, Ctrl, Meta or Shift held: focus does not move and the event is not cancelled. Plain keys behave as before.

## Standard cited

WAI-ARIA Authoring Practices 1.2, Toolbar pattern keyboard interaction (the navigation keys are the unmodified arrows, Home and End); WCAG 2.2 SC 2.1.4 spirit and platform practice: browser and OS shortcuts are not overridden by page widgets.
