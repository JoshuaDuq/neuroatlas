# Focus is handed on when its control stops being available

Chunk: H3
Status: fix (standard cited)

## Legacy behaviour

Three paths leave focus on a control that is hidden or disabled, which drops it to the page:

- the bar widens while the summary has focus and the tract reference is showing, so no select is visible to receive it (header.js:361);
- the tract reference starts while a field or the summary has focus: every field and the summary are hidden;
- the subject select becomes `disabled` while a download runs (header.js:510).

## New behaviour

The next visible, enabled control after the data bar in the masthead takes focus before the controls go (the reference) or when no select can receive it (widening). The subject select hands focus to the Atlas select when a download starts. The other legacy hand-offs are unchanged.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and SC 2.4.7 Focus Visible: focus must not be lost to the document.
