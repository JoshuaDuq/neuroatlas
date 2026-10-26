# A failed cut-atlas switch from the anatomy search is reported

Chunk: I1

## Legacy behaviour

The navigator's "switch cut atlas" calls `sections.setCutAtlas(id).catch(() => {})` (app.js:564-566). The cut panel reports a download failure only while the cut still names that atlas; when closing the cut overtakes the download, `sections` rolls back without reporting and the rejection is swallowed, so the failure is shown nowhere (E4a review, #4 issuecomment-6401559366).

## New behaviour

The panel awaits S3's `excursions.setCutAtlas(id)` and reports a rejection through the scene commands' `fail('layer', error, name)`: the error is logged and the notice under the tabs says "Could not load NextBrain." (or the atlas chosen), which the announcer speaks. No new string.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (the outcome of an action is presented to the reader and to assistive technology); CLAUDE.md fail fast (no swallowed errors). Decided on #4 in decision 9 and the A2 review (issuecomment-6409447032, item 3).
