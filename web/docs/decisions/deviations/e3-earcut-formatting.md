# E3 note: `earcut.js` is prettier-formatted

Chunk E3 (#26), conductor decision 47 on #4. Not a behaviour change.

- **Legacy** (`viewer/tissues/earcut.js`): the vendored earcut 2.2.4 as published upstream.
- **New** (`engine/tissues/earcut.js`): the same file, whitespace-only reformatted by prettier so
  `prettier --check .` passes. The upstream bytes return once lane A adds a `.prettierignore` entry.
- **Check**: `parity/E3.test.ts` compares triangulations and deviation with the legacy copy on
  seeded polygons with holes.
