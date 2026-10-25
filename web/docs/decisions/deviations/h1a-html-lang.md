# The page language is right before the app loads

Chunk: H1a

## Legacy behaviour

index.html:2 ships `<html lang="en">` over a static English shell, which is consistent. The running app sets the language before its first translated paint (`app.js:151-152`) and before any error text (`main.js:44-46`), so legacy never speaks translated text under the wrong `lang`.

The new app renders localised text from its first component, before any store has set `lang`. Without a head script, a reader who chose French, or opened a `#lang=fr` link, would hear that text under `lang="en"`.

## New behaviour

The inline head script of `web/index.html` sets `<html lang>` before the first paint, with `startLanguage`'s precedence: the link's `lang` (`en` or `fr`), else the saved `planum-lang` choice when it is `fr`, else `en`. A `lang` repeated in the link decides nothing, as in `decodeState`. A unit test runs the script and `startLanguage` on the same table.

## Standard cited

WCAG 2.2 SC 3.1.1 Language of Page (A).
