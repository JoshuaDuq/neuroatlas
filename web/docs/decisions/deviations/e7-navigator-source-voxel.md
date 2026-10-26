# E7 deviation: the MRI navigator reports source voxels, whatever moved the crosshair

Chunk E7 (#31), in E6's `diffusion/navigation-viewer.ts` (handed over by the conductor on #4). A fix under the
parity policy (a field means one thing).

- **Legacy** (`viewer/diffusion/navigation-viewer.js`, `navigation-ui.js:99,116`): `setVoxel` and
  `setScannerPoint` report the source voxel they were given. Every other location, an arrow key
  (`moveVoxel`) or a click, is NiiVue's own report, whose `vox` is the RAS-reordered voxel. On a scan whose
  x axis runs against the source index (the CDMD reference MRI, affine x = -1), `setVoxel([10, 20, 30])`
  reports `[10, 20, 30]`, then `moveVoxel([1, 0, 0])` reports `[166, 20, 30]` with a four-component `mm`
  while the crosshair is on source voxel `[9, 20, 30]`. The dialog labels its fields "Source voxel
  (0-based)", fills them from that report and sends them back through `setVoxel`, so "Go to voxel" after
  an arrow key or a click jumped to the mirrored voxel in the other hemisphere.
- **New**: every NiiVue report is rebuilt from its scanner point: `mm` is the first three components,
  `vox` is `scannerVoxel(mm, header)`, the source voxel. A report before the volumes load, which has no
  grid, is not forwarded; a point outside the grid throws `RangeError`. `api.ts` documents `vox` as the
  source voxel and `mm` as three components, and `moveVoxel` as a step in the display's direction.
- **Standard**: a value is reported in the units its label and its setter use (the dialog's own
  "Source voxel (0-based)" wording, `core/i18n/areas/mri.ts:15`); WCAG 2.2 SC 3.3.2 (Labels or
  Instructions) expects a field to mean what its label says.
- **Test**: `diffusion/navigation-viewer.test.ts`, "reports the source voxel and a three-component point";
  the contract suite asserts the last report equals the voxel asked for and that `moveVoxel` moves one
  voxel along one axis, on the fake and on the real navigator.
