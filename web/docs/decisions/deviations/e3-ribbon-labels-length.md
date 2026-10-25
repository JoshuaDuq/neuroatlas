# E3 deviation: `loadRibbonSources` checks the published byte length

Chunk E3 (#26), decision 46 on #4. Pinned by `solid-assets.test.ts`.

- **Legacy** (`viewer/tissues/solid-assets.js`): the file was read as is; a short one failed only
  indirectly, in `buildRibbonWedges`, and a long one was silently truncated.
- **New** (`engine/tissues/solid-assets.ts`): the file must hold 2 bytes per vertex of both
  hemispheres (`vertex_counts`), else it throws an `Error` naming the atlas and both sizes.
- **Standard**: CLAUDE.md, "validate inputs at boundaries".
