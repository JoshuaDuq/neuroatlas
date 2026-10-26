# A landmark on the region already selected is said

Chunk: X3
Status: fix (decision 40 on #4, bug 5); listed in the X3 PR

## Legacy behaviour

The only spoken cue after Previous, Next or a landmark row was the selection sentence the announcer says when the selected region changes. Opening the landmark that is already selected (Return, or the current row of the sequence) changes no region, so nothing was said and a screen-reader reader heard only the pressed button.

## New behaviour

After a landmark opens, if the selected region is the one selected before the run, the panel announces `text.step` and the landmark's name, for example "Landmark 2 of 5: Optic chiasm" (no new string). When the region changes, the selection sentence the view already says is enough, and the panel says nothing.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages.
