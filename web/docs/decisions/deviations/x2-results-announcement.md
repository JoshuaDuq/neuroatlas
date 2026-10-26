# Every settled search says its count, a cleared one included

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

announce.js skips any sentence equal to the last one spoken for ever, and clinical.js:513 says nothing when the query is cleared. Searching "a", "ab", "a" is silent the third time, and so are two different queries with the same count. A language change re-announced the count.

## New behaviour

The count is said 500 ms after a query settles, including a cleared query (the full count). The announcer forgets its last sentence before each, so an equal sentence is written again. A language change says nothing (decision 37 on #4).

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages.
