# The system select is disabled while an atlas or detail level loads

Chunk: A3
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

The scope buttons are disabled while `status === 'switching'`, but the system select is not (`viewer/ui/panels/internal-anatomy.js:33`). Switching rebuilds the list of systems, so a choice made meanwhile can name a system the new level does not have.

## New behaviour

`SystemPicker.svelte` takes `switching` and disables the select while it is true, as the scope control is.

## Standard cited

Consistency within the same region (WCAG 2.2 SC 3.2.4 Consistent Identification, in spirit) and native-control practice: a control that cannot act is disabled, not left to fail.
