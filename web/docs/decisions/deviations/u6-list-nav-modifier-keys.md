# List navigation leaves modified arrow keys alone

Chunk: U6
Status: fix (no approval needed; parity policy of 2026-10-25 on #4)

## Legacy behaviour

panels/functions.js:339-377 and panels/clinical.js:407-440 call `preventDefault()` on ArrowDown and Enter in the search field and on ArrowUp/ArrowDown in the result list whatever modifiers are held, and move focus. Alt+Arrow, Ctrl/Cmd+Arrow and Shift+Arrow are swallowed. In the list, an arrow pressed on a focused element that is not a row (index -1) jumps to the first row on Down.

## New behaviour

`listNav` ignores a `keydown` with Alt, Ctrl, Meta or Shift held, or during IME composition: focus does not move and the event is not cancelled. Only keys pressed on a row move focus; the list's other focusable children keep their native arrow behaviour. Plain keys behave as before.

## Standard cited

WAI-ARIA Authoring Practices, "Developing a Keyboard Interface" > Keyboard Shortcuts, https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#keyboardshortcuts ("Browser Key Conflicts", "Operating System Key Conflicts"); same rule as deviations/u2-roving-modifier-keys.md. IME: UI Events `KeyboardEvent.isComposing`, https://www.w3.org/TR/uievents/#dom-keyboardevent-iscomposing.
