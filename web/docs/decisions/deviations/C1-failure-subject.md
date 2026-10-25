# C1 · A failure that names its subject refuses to be worded without one

**Legacy behaviour.** `failureNotice(error, lang, 'layer')` (i18n/errors.js:13) called the operation's text function with `subject` undefined and produced "Could not load undefined." for the `layer` and `colour` operations.

**New behaviour.** `failureNotice` throws `Error('<operation> failure text needs a subject')` when the operation's text is a function and no subject is passed. Every legacy call site passes a subject for those two operations, so no reachable output changes; only the misuse now surfaces.

**Standard.** Project rule "fail fast" (CLAUDE.md): an unexpected error must surface, not render the literal "undefined" in user-facing text (also WCAG 3.3.1 error identification: an error message the reader cannot act on is not an identification).
