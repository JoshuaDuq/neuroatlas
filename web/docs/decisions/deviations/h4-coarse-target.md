# Provenance button target size on coarse pointers

Chunk: H4
Status: fix (standard cited)

## Legacy behaviour

viewer/styles/masthead.css `#provenance` is 24 px tall at every width, in a 32 px status bar. The 44 px coarse rule (phone.css:44) applies only under the phone query, where the status bar is hidden, so a touch laptop or tablet wider than 800 px gets a 24 px target.

## New behaviour

Under `@media (pointer: coarse)` the status bar is 45 px tall, its 1 px rule above a 44 px button (`--footer-height` in `web/src/app/layout.css`, a hand-over of that one rule to H4) and the Provenance button fills the 44 px below the rule. A fine pointer keeps the 32 px bar and a 24 px button.

## Standard cited

WCAG 2.2 SC 2.5.5 Target Size (Enhanced, AAA) and Apple HIG's 44 pt minimum, which is the project's rule for coarse pointers (as the dialog Close button and `.icon-button` do). SC 2.5.8's 24 px floor was already met.
