# E4a deviation: the cut calls its collaborators directly and names an unloaded MRI

Chunk E4a (#27). A fix under the parity policy (CLAUDE.md: "fail fast, no silent fallbacks"). Two
changes, neither of which alters a result the app can reach in production;
`sections.test.ts` (SLICE-15) pins the values `sample()` reads once the MRI is loaded.

## Direct calls on members that always exist

- **Legacy** (`viewer/slices/sections.js`): `this.tissues.hasDetail?.(s.detail) ?? true` and
  `this.tissues.solids?.warm()`; `this.model.manifest?.` and `this.model.state?.` (`:112-113`);
  and `hit.object?.userData?.` in `pick` (`:455`). The optional calls exist only so the legacy
  test stubs, which omit those members, keep working; the real `TissueSections` and model always
  have them.
- **New** (`engine/slices/sections.ts`): `hasDetail(...)`, `solids.warm()`, `manifest.`, `state.`
  and `hit.object.userData[...]` are direct. The ported test stubs gain the members they lacked
  (`hasDetail`, `solids.warm`, `manifest: {}`). A collaborator without them is a programming error
  and throws a `TypeError` instead of being skipped.
- **Standard**: project rule "fail fast, no silent fallbacks" (CLAUDE.md); the types declare these
  members, so the optional call is also a no-op for the type checker.

## `pixels()` and `sample()` before the MRI loads

- **Legacy**: both read `this.volumes.*` / `this.display` with no guard, so calling them before
  `load()` resolved threw `TypeError: Cannot read properties of null`.
- **New**: both throw `Error('The linked MRI has not loaded.')`. `api.ts` documents the same
  precondition ("Needs the MRI loaded"). The condition that throws is unchanged; the error class
  changes from `TypeError` to `Error` and the message names the cause.
- **Standard**: CLAUDE.md fail fast; a precondition violation reports the violated precondition.

## A label code missing from the cut atlas's table throws, as in legacy

`TissueSections.intersect` keeps the legacy dereference of `metadata.labels[code]` on the sampled
face path, so a code absent from the table throws a `TypeError` (legacy `gpu-sections.js:432`)
rather than returning `null`. An intermediate port returned `null` there; that silent fallback is
removed, so no deviation remains for this site.
