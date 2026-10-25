# C1 · The loading line writes megabytes in the reader's notation

**Legacy behaviour.** `viewport.loadingWithTotal` (i18n/translations.js:5, 968) formatted sizes with `toFixed(1)` and joined the unit with a breaking space: French read "12.3 / 46.1 Mo" with an English decimal point.

**New behaviour.** Both languages use `withUnit(decimal(bytes / 1_048_576, 1, lang), 'MB' | 'Mo', lang)`: French reads "12,3 / 46,1 Mo" with a decimal comma, and the unit is held to its number by a narrow no-break space (English changes only in that space).

**Standard.** Unicode CLDR `fr` number symbols (the decimal separator is the comma; `Intl.NumberFormat('fr')` gives "12,3"); the project's own unit rule in `format.ts` (`withUnit`, never a breaking space).
