# E4b deviation: `loadHiddenRegions` releases an isolation the new set removes

Chunk E4b (#28). Pinned by `brain-atlas.test.ts` ("loading a hidden set that holds the isolated
region releases the isolation").

- **Legacy** (`viewer/model/brain-atlas.js:885`): `hideRegions` clears the isolation when the
  isolated region becomes hidden (line 862), but `loadHiddenRegions` replaced the whole hidden set
  without that check. With the isolated region in the loaded set, every region was hidden: the
  isolated one as removed, all the others as not isolated. The scene went empty, and only an
  explicit `clearIsolation` or `reset` brought it back. A permalink restore reaches it only when the region is already isolated and the link both hides and isolates it; otherwise the later isolate step clears it.
- **New** (`engine/model/brain-atlas.ts`): both entry points share one rule. After the set is
  replaced, an isolated region that is now hidden is released, exactly as `hideRegions` does. An
  isolation of a region the set leaves visible is kept.
- **Standard**: the invariant the module itself enforces. `hideRegions` (legacy line 862) releases
  an isolated region that becomes hidden, because `visibilityOf` tests `removed` before `isolated`
  and the combination leaves no region visible. `loadHiddenRegions` replaces the same set and must
  keep the same invariant; the fix applies the sibling's rule rather than a new one.
