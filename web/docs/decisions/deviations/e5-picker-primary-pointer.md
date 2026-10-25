# E5: a second pointer cancels the tap

Chunk E5 (#29). A fix under the parity policy on #4.

- **Legacy** (`viewer/render/picking.js`): `pointerdown` overwrote the single `pressed` record
  whatever pointer it came from. With two fingers down, the second finger replaced the first one's
  press, so the first finger lifting within the touch slop (12 px) of where the second had landed
  was read as a tap and selected the region under it.
- **New** (`engine/render/picking.ts`): a `pointerdown` from a pointer whose `isPrimary` is false
  cancels the pending tap, and a non-primary `pointerup` is ignored. A second pointer cancels the
  tap, so a pinch or two-finger drag never ends as a selection, whichever finger lifts first.
  Single-pointer input (mouse, pen, one finger) is unchanged.
- **Standard**: Pointer Events Level 3: "Authors who desire single-pointer interaction can achieve
  this by ignoring non-primary pointers."; WCAG 2.2 SC 2.5.2 Pointer Cancellation (a multi-finger
  gesture is not a single-pointer activation). Pinned by two tests in `picking.test.ts`; the parity
  test drives primary pointers only.
