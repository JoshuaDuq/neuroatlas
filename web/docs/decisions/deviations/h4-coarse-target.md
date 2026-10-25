# Provenance button target size on coarse pointers

Chunk: H4
Status: fix (standard cited)

## Legacy behaviour

viewer/styles/masthead.css `#provenance` is 24 px tall at every width. The 44 px coarse rule (phone.css:44) applies only under the phone query, where the status bar is hidden, so a touch laptop or tablet wider than 800 px gets a 24 px target.

## New behaviour

`@media (pointer: coarse)` makes the status bar's Provenance button 44 px tall at any width; a fine pointer keeps 24 px.

## Standard cited

WCAG 2.2 SC 2.5.8 Target Size (Minimum) sets 24 px as the floor; the project's rule for coarse pointers is 44 px (as the dialog Close button and `.icon-button` do).
