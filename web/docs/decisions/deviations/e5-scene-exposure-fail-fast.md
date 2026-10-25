# E5: a missing exposure token is an error

Chunk E5 (#29). A fix under the parity policy on #4.

- **Legacy** (`viewer/render/scene.js`): `Number(token('--scene-exposure')) || 1`, so an empty,
  missing or non-numeric token silently became an exposure of 1.
- **New** (`engine/render/scene.ts`): `applyTheme` parses the token and throws
  `The --scene-exposure token is not a number.` when it is empty or not finite. A defined token
  gives the same exposure as before; note a token of `0` is now exposure 0 rather than 1.
- **Standard**: CLAUDE.md rule 3 (fail fast, no silent fallbacks); validating inputs at boundaries.
