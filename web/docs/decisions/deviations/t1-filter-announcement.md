# The search says how many bundles it kept

Chunk: T1
Status: fix (decision 42, B5); listed in the T1 PR

## Legacy behaviour

Typing in the search changed the list and the caption silently. No live region announced the count or the empty state (`native-ui.js:123-136`).

## New behaviour

After typing pauses (500 ms, U2's debounced announcer, so one sentence per pause and none repeated), the page says "{n} tract bundles", or "No match for “{query}”. Try another tract name." Clearing the field may say its count again. A language switch does not announce.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages; ARIA22.
