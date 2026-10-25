# E3 deviation: `exposedWhiteMatter` names an unknown region id

Chunk E3 (#26), decision 46 on #4. Pinned by `solid-assets.test.ts`.

- **Legacy** (`viewer/tissues/white-matter-surfaces.js`): `regions.get(id).kind` threw an opaque
  `TypeError` for a hidden id absent from the region index.
- **New** (`engine/tissues/white-matter-surfaces.ts`): throws
  `Hidden region <id> is not in the region index.`
- **Standard**: CLAUDE.md, "fail fast".
