# Each plane is a named region and keeps its heading

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

The three planes are unnamed `article`s, and on a phone `display:none` removes each plane's `h3`, so the plane on screen has no heading at all (sections.js:265, dialogs.css:288).

## New behaviour

Each plane is a `section` named by its `h3`. On a phone the heading is hidden visually, not removed, because the radio group names the plane for sighted readers.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships, SC 2.4.6 Headings and Labels; APG landmark naming practice.
