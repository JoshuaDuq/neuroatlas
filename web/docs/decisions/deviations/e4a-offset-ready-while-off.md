# E4a deviation: `setOffsetReady` works while the cut is off

Chunk E4a (#27). A fix under the parity policy. Pinned by `sections.test.ts` ("the offset can be
set while the cut is off").

- **Legacy**: `setOffsetReady` built `centeredFrame(this.state.mode, ...)` before `commitFrame`
  ran, so mode `off` threw `Unknown section plane: off`, although `commitFrame` handles the
  inactive cut and `setOffset` and the `frame` getter work in that state. The UI disables the
  slider while off, so the throw was latent; `EngineSections.setOffsetReady` is a public contract.
- **New**: the frame is built for `this.active ? this.state.mode : 'axial'`, the same fallback as
  the `frame` getter; `commitFrame` then stores the crosshair without drawing.
- **Standard**: a public method that its sibling `setOffset` supports in a state must not throw
  `Unknown section plane` for that state (consistent API contract).
