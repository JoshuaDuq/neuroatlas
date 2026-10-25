# Diffusion MRI dialog strings in i18n

Chunk: C1
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

viewer/diffusion/navigation-ui.js:8-29 keeps the dialog strings in a local table outside the i18n module, and the Linked MRI tissue names live in ui/chrome/sections.js:29-47. #4 describes the dialog as English-only; the source shows a local FR table, so the substance of the change is a single source of truth with French reviewed (see PR note).

## New behaviour

All dialog strings and MPR tissue names move to `src/lib/core/i18n`, with the French strings listed in C1's PR for review.

## Standard cited

WCAG 2.2 SC 3.1.1 and 3.1.2 (language); one translation source is established i18n practice.
