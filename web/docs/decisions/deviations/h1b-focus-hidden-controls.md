# Focus is not lost when the stage status hides the focused control

Chunk: H1b
Status: fix under the parity policy

## Legacy behaviour

The `loading`, `error` and `context-lost` statuses hide the stage dock (`stage.css:315`), and `loading` and `error` hide the masthead data bar (`masthead.css:85`) with `visibility: hidden` and the inspector (`layout.css:212`) with `display: none`. A reader whose focus was in one of them silently loses it to `body`, and nothing returns it when the anatomy comes back.

## New behaviour

When the status becomes `error` or `context-lost` and the control that held focus is no longer visible, focus moves to Retry (`error`) or to the status message (`context-lost`). When the status returns to `ready` and focus is on `body`, it returns to the remembered control if it is still in the page. Focus is otherwise never touched, and a boot or startup failure does not take focus.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA Authoring Practices, "Developing a Keyboard Interface", "Discernible and Predictable Keyboard Focus": focus persists, and when the focused element goes away it moves to a logical element.
