# E4a deviation: the cut calls its collaborators directly and names an unloaded MRI

Chunk E4a (#27). A fix under the parity policy (CLAUDE.md: "fail fast, no silent fallbacks"). Two
changes, neither of which alters a result the app can reach in production; the parity test
(`web/parity/E4a.test.ts`) pins that `sample()` and `pixels()` match the legacy values once the
MRI is loaded.

## Direct calls on `TissueSections` members

- **Legacy** (`viewer/slices/sections.js`): `this.tissues.hasDetail?.(s.detail) ?? true` and
  `this.tissues.solids?.warm()`. The optional calls exist only so the legacy test stubs, which
  omit those members, keep working; the real `TissueSections` always has both.
- **New** (`engine/slices/sections.ts`): `this.tissues.hasDetail(s.detail)` and
  `this.tissues.solids.warm()`. The ported test stubs gain the two members. A tissues object that
  lacks them is a programming error and now throws a `TypeError` instead of being skipped.
- **Standard**: project rule "fail fast, no silent fallbacks" (CLAUDE.md); `TissueSections`
  declares both members, so the optional call is also a no-op for the type checker.

## `pixels()` and `sample()` before the MRI loads

- **Legacy**: both read `this.volumes.*` / `this.display` with no guard, so calling them before
  `load()` resolved threw `TypeError: Cannot read properties of null`.
- **New**: both throw `Error('The linked MRI has not loaded.')`. `api.ts` documents the same
  precondition ("Needs the MRI loaded"). The thrown condition is unchanged; only the message names
  the cause.
- **Standard**: CLAUDE.md fail fast; a precondition violation reports the violated precondition.
