# The result count is announced for the query, not for a language switch

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

functions.js:421-455 announces the count when the list is rebuilt, and the list key includes the language, so a language switch announces the count again while a query is active although the reader typed nothing. announce.js:7-14 never forgets the last sentence, so after clearing and retyping the same query nothing is said.

## New behaviour

The count is said 500 ms after typing pauses, from the query and the counts only (a language switch changes neither, so nothing is said). A cleared search forgets the last sentence (U2's announcer `reset`), so the same query typed again is announced.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (AA): status for relevant changes only, and every relevant change.
