# A related circuit row's name begins with its visible words

Chunk: X3
Status: fix (standard cited)

## Legacy behaviour

A related circuit row showed "Name 2 of 5" and was named "Name, Landmark 2 of 5" (circuits.js:243-247): the visible "2 of 5" was `aria-hidden` and the hidden words stood between the visible ones.

## New behaviour

The visible words stay (name, then "2 of 5") and are not hidden from assistive technology; a hidden ", Landmark" follows them, so the name is "Name 2 of 5, Landmark". The circuit rows already satisfy it ("Name 4" is within "Name, 4 landmarks").

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name.
