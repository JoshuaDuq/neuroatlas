# Focus is not lost when the stage status hides the focused control

Chunk: H1b
Status: fix under the parity policy

## Legacy behaviour

The `error` and `context-lost` statuses hide the stage dock (`stage.css:315`) and the masthead data bar (`masthead.css:85`) with `visibility: hidden`. A reader whose focus was in one of them silently loses it to `body`, and nothing returns it when the anatomy comes back.

## New behaviour

When the status becomes `error` or `context-lost` and the control that held focus is no longer visible, focus moves to Retry (`error`) or to the status message (`context-lost`). When the status returns to `ready` and focus is on `body`, it returns to the remembered control if it is still in the page. Focus is otherwise never touched, and a boot or startup failure does not take focus.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA Authoring Practices, "Managing focus": when the focused element is hidden or removed, move focus to a logical element.
