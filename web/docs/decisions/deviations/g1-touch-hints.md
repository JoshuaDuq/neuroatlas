# Touch wording for the navigation hint on coarse pointers

Chunk: G1
Status: approved (conductor decision 21 on #4)

## Legacy behaviour

The navigation hint reads "Drag to rotate · Scroll to zoom · Click to inspect" on every device (i18n `viewport.navigationHint`), although a finger neither scrolls nor clicks.

## New behaviour

Where the primary pointer is coarse (`(pointer: coarse)`), the hint names the gestures a finger makes: "Drag to rotate · Pinch to zoom · Tap to inspect", and for the independent tract reference "Drag to rotate · Pinch to zoom"; French "Glisser : tourner · Pincer : zoom · Toucher : inspecter" and "Glisser : tourner · Pincer : zoom". The strings now live in the `viewport` i18n namespace as `navigationHintTouch` and `navigationHintTractsTouch`. Mouse and keyboard devices keep the legacy wording.

## Standard cited

WCAG 2.2 SC 3.3.2 Labels or Instructions (instructions describe the gestures the user has); platform terms for touch (Apple HIG Gestures, Material 3 Gestures).
