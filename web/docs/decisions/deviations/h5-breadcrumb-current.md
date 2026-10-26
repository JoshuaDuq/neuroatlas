# The place crumb's aria-current is set only while it is shown

Chunk: H5

## Legacy behaviour

index.html:331 hard-codes `aria-current="location"` on the group crumb button, which is a button that returns to the list ("show in the list"), not a link to the current page.

## New behaviour

The crumb carries `aria-current="location"` only while it is rendered. The token stays `location`, not `page`: the crumb names a place within the mode, and activating it moves there. The first item is a Back button, not a link, because the list/detail view is not a URL.

## Standard cited

WAI-ARIA APG Breadcrumb pattern (`aria-current` on the current item; `page` is for a document location); WAI-ARIA 1.2 `aria-current` tokens.
