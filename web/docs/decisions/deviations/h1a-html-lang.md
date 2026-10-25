# The page language is right before the app loads

Chunk: H1a

## Legacy behaviour

index.html:2 ships `<html lang="en">`. The language is applied only when the app runs (`app.js:1621`, `main.js:42`), so a reader who chose French, or opened a `#lang=fr` link, meets the loading text and an early error screen under the English voice of their screen reader.

## New behaviour

The inline head script of `web/index.html` sets `<html lang>` before the first paint, with `startLanguage`'s precedence: the link's `lang` (`en` or `fr`), else the saved `planum-lang` choice when it is `fr`, else `en`. A unit test runs the script and `startLanguage` on the same table.

## Standard cited

WCAG 2.2 SC 3.1.1 Language of Page (A).
