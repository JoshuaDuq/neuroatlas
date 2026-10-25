# C4 · Releasing notices that were never held fails without corrupting the hold count

**Legacy behaviour.** `session.releaseNotices()` (state/session.js:153) decremented the hold counter before reading the held list. Called with nothing held and no lead notice it left the counter at -1 and then threw a `TypeError` reading `.length` of null; with a lead notice it threw reading `.unshift` of null. After the first case every later `holdNotices()`/`releaseNotices()` pair was off by one, so notices were released too early or never.

**New behaviour.** `releaseNotices` throws `Error('No notices are held.')` before touching the counter, so an unbalanced call surfaces at once and leaves the session as it was. Every legacy call site pairs a hold with a release, so no reachable output changes. The parity test draws only balanced sequences.

**Standard.** Project rule "fail fast" (CLAUDE.md): an unexpected error must surface as itself and leave state consistent, not as an accidental `TypeError` after corrupting a counter.
