# A second Save image while one is made saves once

Chunk: G6
Status: fix (standard cited)

## Legacy behaviour

The snapshot waits for its fonts before it captures (viewport-chrome.js:828), and the button stays enabled meanwhile. A double click or a repeated Enter starts two captures and downloads two files.

## New behaviour

A request while a save is in progress joins it: one capture, one file, one announcement. The button is unchanged and keeps focus.

## Standard cited

Established practice for non-idempotent actions: ignore repeated activation while the first is in flight (Nielsen Norman Group, error prevention; GOV.UK Design System, "Prevent double clicks" on buttons).
