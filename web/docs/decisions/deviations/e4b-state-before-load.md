# E4b deviation: the model never reports a null atlas or detail, and the cut cannot hand it a null scan

Chunk E4b (#28). Pinned by `brain-atlas.test.ts` ("the settings name the first atlas and the
default detail before anything has loaded", "the cut can hand the model an anatomy only once the
MRI has loaded").

- **Legacy** (`viewer/model/brain-atlas.js:180`): `atlasId` and `detailId` start as `null`, so
  `settings.atlas` and `settings.detail` were `null` between the constructor and `initialize`.
  `setMriAnatomy(null)` failed with a bare `TypeError` reading `mriUniforms` of null.
- **New** (`engine/model/brain-atlas.ts`): the two ids start as the first published atlas and the
  default detail level, which are what `initialize` loads by default; nothing is drawn until it has
  run (`visibleMeshes` is empty, as before). `setMriAnatomy(null)` throws
  `MRI anatomy has not loaded.` Nothing in the app reads the settings before `initialize` resolves
  (`BrainAtlas.load` is the only path to a model), so behaviour after `initialize` is unchanged.
- **Standard**: the shared contract. `DisplaySettings.atlas` and `.detail` are `string`
  (`types/display.ts`), and E4a's `SectionsModel.setMriAnatomy` takes `Anatomy | null`; TypeScript
  strict mode (`strictNullChecks`) forbids a model that satisfies them while returning `null` or
  dereferencing a `null`. The alternative, throwing from `settings` before `initialize`, would turn
  a harmless read into a failure inside promise chains that call `update()` early (the envelope
  download), so the types are met by a defined initial value instead.
