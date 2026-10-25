# E4b deviation: `loadHiddenRegions` releases an isolation the new set removes

Chunk E4b (#28). Pinned by `brain-atlas.test.ts` ("loading a hidden set that holds the isolated
region releases the isolation") and `parity/E4b.test.ts` ("E4b documented deviations").

- **Legacy** (`viewer/model/brain-atlas.js:885`): `hideRegions` clears the isolation when the
  isolated region becomes hidden (line 862), but `loadHiddenRegions` replaced the whole hidden set
  without that check. With the isolated region in the loaded set, every region was hidden: the
  isolated one as removed, all the others as not isolated. The scene went empty, and only an
  explicit `clearIsolation` or `reset` brought it back. A permalink restore is the way to reach it.
- **New** (`engine/model/brain-atlas.ts`): both entry points share one rule. After the set is
  replaced, an isolated region that is now hidden is released, exactly as `hideRegions` does. An
  isolation of a region the set leaves visible is kept.
- **Standard**: no standard covers it. It is a plain inconsistency inside one module: the same
  state (an isolated region that is hidden) is resolved by one command and left contradictory by
  its sibling, and the contradictory state shows an empty brain with no way to see why
  (`visibilityOf` tests `removed` before `isolated`, so no region is left).
