# Touch targets are 44 px on any coarse pointer

Chunk: T2
Status: fix (decision 41 (targets)); listed in the T2 PR

## Legacy behaviour

The 44 px control height followed the phone viewport query only (`phone.css`), so a tablet or a touch laptop in a wide window got 32 px controls.

## New behaviour

Inside the dialog `--control-height` is 44 px on `(pointer: coarse)`, whatever the window width.

## Standard cited

WCAG 2.2 SC 2.5.8 Target Size (Minimum) is met either way; 44 px follows the project's target rule and SC 2.5.5.
