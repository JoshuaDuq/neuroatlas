# The handle's own line is 24 px, and the name beside the side-sheet handle is a 44 px row

Chunk: H6

## Legacy behaviour

The handle fills the grip row, but the selection strip and its clear sit over everything below the top line, so the part of the handle a pointer can reach is the top `--space-5` (20 px) line (phone.css:116-134), measured at 20 px. axe's `target-size` rule fails it. On the side sheet the name is a row of its own text height plus padding, 33 px (phone.css:267-271; the side handle's rule is 296-299).

## New behaviour

The handle's line is 24 px (`--handle-row`), measured 23 to 24 px of unobscured height. The side sheet's name is at least `--control-height` (44 px in the phone shell) tall, as every other control of the phone shell is.

## Standard cited

WCAG 2.2 SC 2.5.8 Target Size (Minimum), 24 by 24 CSS pixels, for the handle. For the side-sheet name, which already met 2.5.8, the 44 px target of #45's definition of done for coarse pointers (WCAG 2.5.5 Target Size (Enhanced), AAA; Apple HIG 44 pt).
