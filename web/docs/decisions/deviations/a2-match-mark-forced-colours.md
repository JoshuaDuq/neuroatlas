# The match is underlined in forced colours

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

A matched part of a result's name is marked by the accent colour and a heavier weight (`viewer/styles/navigator.css:250`, `.query-match`). Forced colours replace the accent with the system text colour, leaving a weight of 600 against 400, which is hard to see in many fonts, so the match could be marked by colour and almost nothing else.

## New behaviour

Under `forced-colors: active` the mark takes the text's colour and an underline, in `@layer a11y`.

## Standard cited

WCAG 2.2 SC 1.4.1 Use of Color.
