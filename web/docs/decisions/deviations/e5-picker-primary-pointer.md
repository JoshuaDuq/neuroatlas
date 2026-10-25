# E5: the picker counts only the primary pointer as a tap

Chunk E5 (#29). A fix under the parity policy on #4.

- **Legacy** (`viewer/render/picking.js`): `pointerdown` overwrote the single `pressed` record
  whatever pointer it came from. With two fingers down, the second finger replaced the first one's
  press, so the first finger lifting within the touch slop (12 px) of where the second had landed
  was read as a tap and selected the region under it.
- **New** (`engine/render/picking.ts`): `pointerdown` and `pointerup` from a pointer whose
  `isPrimary` is false are ignored. A tap is the primary pointer's press and release, so a second
  finger neither replaces the press nor ends it. Single-pointer input (mouse, pen, one finger) is
  unchanged.
- **Standard**: Pointer Events Level 3, `isPrimary` ("the pointer that represents the first
  contact of a multi-touch gesture; single-pointer interactions should ignore non-primary
  pointers"); WCAG 2.2 SC 2.5.2 Pointer Cancellation (a multi-finger gesture is not a single-pointer
  activation). Pinned by two tests in `picking.test.ts`; the parity test drives primary pointers only.
