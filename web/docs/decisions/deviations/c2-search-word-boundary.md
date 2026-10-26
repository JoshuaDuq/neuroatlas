# C2: search word boundary

**Chunk:** C2 (#20), `web/src/lib/core/catalog/catalog.ts` (`startsAWord`).

**Legacy behaviour** (`viewer/catalog/catalog.js:14`): the character before a match is tested with `/[a-z0-9]/`, so every accented letter (é, è, ç, ...) counts as a non-word character. A match in the middle of a French word after an accented letter is ranked as a word-start match. In French, `ra` ranks "Aire hypothalamique latérale (partie postérieure)" (match inside "latérale") above "Noyau dorsal du raphé"; `tal` ranks every "pariétal" label before "frontal" and "temporal"; `cun` ranks "Précunéus" as a word start.

**New behaviour:** the preceding character is tested with `/[\p{L}\p{N}]/u`: any Unicode letter or digit is a word character. A match is a word start only when the previous character is not a letter or digit. Match sets and totals are unchanged; only the order within the ranking tiers changes.

**Standard:** word boundaries between letters and digits follow Unicode UAX #29 (Text Segmentation) and ECMAScript Unicode property escapes (`\p{L}`, `\p{N}`); the function's own contract is "starts at a word boundary".

**Tests:** `catalog.test.ts` (French `ra`); `published-catalog.test.ts` (CAT-22) fixes the published search totals under the corrected predicate (the legacy comparison, `web/parity/C2.test.ts`, is gone).
