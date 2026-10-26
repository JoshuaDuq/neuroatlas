# The field is expanded only when it has options

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

`aria-expanded` follows "there is a query" (`navigator.js:767`), so a search that finds nothing, or only matches in another atlas, announces an expanded popup with an empty listbox.

## New behaviour

`aria-expanded` is `true` only while the listbox holds at least one option. The sentences that say nothing matched, or where the matches are, sit after the list and are also said through the announcer, so nothing is lost.

## Standard cited

WAI-ARIA Authoring Practices, Combobox pattern: `aria-expanded` is true when the popup is displayed; an empty popup is not displayed. Decision 34 on #4.
