# The voxel fields are a named group with their range

Chunk: T2
Status: fix (D5 and fix 11 (decision 41)); listed in the T2 PR

## Legacy behaviour

`index.html:650-654` had an unnamed `<form>` of three inputs named only "i", "j" and "k", with no statement of the valid range and no confirmation. The inputs already had `min=0 step=1 required` and the grid size was set as `max` (`navigation-ui.js:82`), so the browser's validation stopped an out-of-range voxel; nothing said what the range was.

## New behaviour

The inputs sit in a `role="group"` named by the visible "Source voxel (0-based)". Each is named "Voxel i/j/k" (the visible "i/j/k" is part of the name, WCAG 2.5.3) and described by its range ("0 to 7"). `min`, `max` and `required` keep native validation in front of the engine, so an out-of-range voxel is stopped by the form with the browser's own message, and the range is also read out as the field's description. A successful submit announces the new voxel. The group is a `div`, not a `fieldset`, so the title lays out with the fields (decision 36 does the same).

## Standard cited

WCAG 2.2 SC 1.3.1, SC 3.3.1, SC 3.3.2, SC 4.1.2 and SC 4.1.3.
