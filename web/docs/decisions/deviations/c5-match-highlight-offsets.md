# C5: search highlight offsets

**Chunk:** C5 (#23), `web/src/lib/core/panels/navigator.ts` (`matchSegments`).

**Legacy behaviour** (`viewer/ui/panels/navigator.js:154-179`, `highlightMatch`): the match is found in the accent-folded, lower-cased text, and that index is then used to slice the original text, for `query.length` characters. The folded text is shorter than the original whenever the original holds decomposed (NFD) accents, and the folded query is shorter than a decomposed query. The catalog search folds the query too, so a decomposed query (pasted from a macOS file name or a PDF) finds rows and then marks the wrong span: `Cortex cérébelleux` with a decomposed `cérébel` marks `cérébelle`; a decomposed name with the query `cere` marks `cér`.

**New behaviour:** the text is folded one code point at a time, recording where each folded code unit starts in the original; the match is mapped back through that table, so the marked span is the same whether the name or the query is composed or decomposed. Composed input marks what legacy marked, with one exception: a query that folds to nothing (a lone combining mark such as U+0301) matches at index 0 in legacy, which marks each row's first `query.length` characters; the new code treats it as no query and marks nothing.

**Standard:** the Unicode Standard, ch. 3, conformance clause C6 (processes must not treat canonically equivalent sequences as distinct), with UAX #15 (Normalization Forms).

**Tests:** `panels/navigator.test.ts` (decomposed query, decomposed name, both); `web/parity/C5.test.ts` compares with the legacy algorithm on composed input only.
