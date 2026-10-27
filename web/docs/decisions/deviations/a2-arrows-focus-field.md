# Up and Down from outside the field while searching go to the field

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

The page's Up and Down keys move the armed result while focus is elsewhere, such as on the canvas (`viewer/app.js:1943-1944`, `navigator.js:652-657`). The armed option is exposed by `aria-activedescendant`, which assistive technology reads only from the focused element, so the move was silent.

## New behaviour

While a search shows, `moveFocus` puts focus in the field, keeping its text and its armed option, and the next key moves it. With no search it walks the tree as before.

## Standard cited

WAI-ARIA Authoring Practices, Combobox pattern (`aria-activedescendant` is on the element that has focus); WCAG 2.2 SC 4.1.2 Name, Role, Value. U6 may export a `move(delta)` so that one key is enough (queued by the conductor).
