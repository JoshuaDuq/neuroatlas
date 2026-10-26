# The system select is disabled while an atlas or detail level loads

Chunk: A3
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

The scope buttons are disabled while `status === 'switching'`, but the system select is not (`viewer/ui/panels/internal-anatomy.js:33`). Switching rebuilds the list of systems, so a choice made meanwhile can name a system the incoming level does not have. `setInternalSystem` then throws (`viewer/model/brain-atlas.js:731-736`) and the reader gets "Could not show this system."

## New behaviour

`SystemPicker.svelte` takes `switching` and disables the select while it is true, as the scope control is.

## Standard cited

A bug fix under the parity policy (decision 36 on #4): a control that cannot act is disabled, as the scope control beside it already is, rather than left to fail.
