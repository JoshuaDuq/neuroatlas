# A partly hidden group says so in its eye's name

Chunk: A1
Status: fix, standard cited.

## Legacy behaviour

A group's eye whose side is partly hidden keeps the name "Hide {group}, {side}". The partial state is `data-partial` (a tint) and a tooltip suffix, "{label} · partially hidden" (`viewer/ui/panels/visibility-control.js:62-71`). A screen reader hears nothing of it.

## New behaviour

The eye's accessible name is "Hide {group}, {side}, partially hidden" while its side is partly hidden. The tint and the tooltip stay. The name still contains the visible side letter's meaning, so SC 2.5.3 holds.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships, SC 4.1.2 Name, Role, Value (state is available to assistive technology).
