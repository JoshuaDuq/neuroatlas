# E6: the brain opacity can be set before the outline loads

Chunk E6 (#30). A fix under the parity policy on #4.

- **Legacy** (`viewer/diffusion/native-viewer.js`, `setOpacity`): dereferenced the outline without a
  check, so a call before `load()` threw a `TypeError`. The panel kept the control disabled, but
  the engine did not enforce it.
- **New** (`engine/diffusion/native-viewer.ts`): the value is validated (0..1, `RangeError`) and
  stored, applied at once if the outline exists, and used when the outline is created, as
  `setOutlineVisible` already does.
- **Standard**: F2's engine contract accepts `setOutlineOpacity` at any time, and project rule
  "fail fast" (CLAUDE.md): a valid call must not fail on hidden state. Pinned by
  `native-viewer.test.ts`.
