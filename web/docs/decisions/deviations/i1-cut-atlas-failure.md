# A failed cut-atlas switch from the anatomy search is reported

Chunk: I1

## Legacy behaviour

The navigator's "switch cut atlas" calls `sections.setCutAtlas(id).catch(() => {})` (app.js:564-566). Legacy `sections.setCutAtlas` reports every download failure into the cut state (`this.report(error)`, viewer/slices/sections.js:348-351), which is visible only while the cut panel is open. From the anatomy search the panel is usually closed, so the failure is shown nowhere and the swallowed rejection hides it completely.

Separately, the ported engine's rollback (`e4a-cut-atlas-rollback.md`, E4a) does not report a failure that closing the cut has overtaken: the state returns to the drawn atlas, `status` stays `ready`, and the failure only rejects the call's promise (E4a review, PR #94, issuecomment-6401555115; note for E7 and G4 on #31, issuecomment-6401559366). That unreported case is the port's, not legacy's, and it is why the rejection must not be swallowed here.

## New behaviour

The panel awaits S3's `excursions.setCutAtlas(id)` and reports a rejection through the scene commands' `fail('layer', error, name)`: the error is logged and the notice under the tabs says "Could not load NextBrain." (or the atlas chosen), which the announcer speaks. No new string.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (the outcome of an action is presented to the reader and to assistive technology); CLAUDE.md fail fast (no swallowed errors). Decided on #4 in decision 9 and the A2 review (issuecomment-6409447032, item 3).
