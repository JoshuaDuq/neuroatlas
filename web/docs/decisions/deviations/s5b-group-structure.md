# Shortcut groups are not unnamed sections

Chunk: S5b
Status: fix (standard cited)

## Legacy behaviour

viewer/ui/chrome/shortcuts.js:94-99 wraps each group's `<h3>` and `<dl>` in a `<section>` with no accessible name.

## New behaviour

Each group is a `<div>` holding the `<h3>` and the `<dl>`. The heading still names the group.

## Standard cited

HTML-AAM and ARIA 1.2: a `<section>` without an accessible name has no `region` role, so it adds markup and no meaning. APG landmark guidance: do not mark up structure that is not a landmark.
