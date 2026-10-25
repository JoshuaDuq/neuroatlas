# C1 · The loading line writes megabytes in the reader's notation

**Legacy behaviour.** `viewport.loadingWithTotal` (i18n/translations.js:5, 968) formatted sizes with `toFixed(1)` and joined the unit with a breaking space: French read "12.3 / 46.1 Mo" with an English decimal point.

**New behaviour.** Both languages use `withUnit(decimal(bytes / 1_048_576, 1, lang), 'MB' | 'Mo', lang)` for each value, so the unit follows each value, held to it by a narrow no-break space. French reads "12,3 Mo / 46,1 Mo" (decimal comma) and English "12.3 MB / 46.1 MB" (English changes only in the added unit after the first value and the space type).

**Standard.** Unicode CLDR `fr` number symbols (the decimal separator is the comma; `Intl.NumberFormat('fr')` gives "12,3"); the SI Brochure (a unit is written with each value); the project's own unit rule in `format.ts` (`withUnit`, never a breaking space).
