# Focus the profile heading after the profile is rendered

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

viewer/ui/panels/clinical.js:276-284 calls the controller, then looks the heading up at once and focuses whatever `.clinical-profile-name` is in the page. If the new profile is not rendered yet, that is the previous deficit's heading, or nothing.

## New behaviour

`openDeficit` starts the run, waits for the next flush (`tick()`), and focuses the heading only if its `data-deficit` is the deficit asked for, after scrolling the profile to its top.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 3.2.2 On Input: a change of context must put focus where the reader is taken.
