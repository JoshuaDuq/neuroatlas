# The handle's own line is 24 px, and the name beside the side-sheet handle is a 44 px row

Chunk: H6

## Legacy behaviour

The handle fills the grip row, but the selection strip and its clear sit over everything below the top line, so the part of the handle a pointer can reach is the top `--space-5` (20 px) line (phone.css:116-134). axe's `target-size` rule fails it. On the side sheet the name is a row of its own text height plus padding, about 32 px (phone.css:296-299).

## New behaviour

The handle's line is 24 px (`--handle-row`), so its unobscured target is 24 by the grip's width, and the side sheet's name is at least `--control-height` (44 px in the phone shell) tall, as every other control of the phone shell is.

## Standard cited

WCAG 2.2 SC 2.5.8 Target Size (Minimum): at least 24 by 24 CSS pixels.
