# Section caption in the section row's name

Chunk: A1
Status: fix, standard cited. Approved with decision 32 on #4.

## Legacy behaviour

The caption that says which display settings hide rows of a section ("Hemisphere hidden", "Cortex hidden", ...) is a `.section-state` span inside an `aria-hidden` heading (`viewer/ui/panels/navigator.js:489-509`). A screen reader never hears it. Sighted readers learn from it, once, why a whole section is dimmed.

## New behaviour

The section's heading row carries the caption in its accessible name, "Cortex (Hemisphere hidden)", and still draws it as before. Individual rows are unchanged: a row hidden by a setting names the reason in its own accessible name ("Name, right: Hemisphere hidden. Activate to reveal.") and prints it only when it is the row's own, as legacy did.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships (information shown visually is available programmatically).
