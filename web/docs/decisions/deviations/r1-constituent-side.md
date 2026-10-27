# Every constituent names its side when the parts span both hemispheres

Chunk: R1
Status: fix under the parity policy (no prior approval needed); listed in the R1 PR

## Legacy behaviour

When a learning unit's parts span both hemispheres (a midline union such as the optic chiasm), each entry got a visible side glyph (`L`, `R`, `Mid`; `G`, `D`, `Méd` in French; constituents.js:45, 50). A structure button also carried `aria-label="Name, left"`, but a cut-only part (a plain `<span>`) exposed only the bare glyph, which a screen reader reads as the letter "L".

## New behaviour

The glyph is `aria-hidden`. The side word ("left", "right", "midline"; "gauche", "droite", "ligne médiane") is visually hidden text after the name, in the button and in the span alike, so the accessible name is "Name, left" and the visible name is part of it. Parts of one hemisphere show and say no side, as before.

## Standard

- WCAG 2.2 SC 1.3.1 Info and Relationships and 4.1.2 Name, Role, Value: information shown visually (the side) is available as text.
- WCAG 2.2 SC 2.5.3 Label in Name: the accessible name starts with the visible label.
- WCAG 2.2 SC 3.1.4 (abbreviations), as guidance: a one-letter glyph is not left unexpanded for assistive technology.
