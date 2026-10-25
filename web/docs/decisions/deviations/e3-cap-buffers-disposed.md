# E3 deviation: `presentSection` releases the buffers it replaces

Chunk E3 (#26), decision 46 on #4. Pinned by `solid-sections.test.ts` (asserts the geometry's
`dispose` event).

- **Legacy** (`viewer/tissues/solid-sections.js`): when a cut outgrew the cap geometry it called
  `setAttribute` with new `position` and `normal` attributes and dropped the old ones. The
  `WebGLRenderer` frees attribute buffers only when the geometry that owns them is disposed
  (`BufferAttribute.dispose()` fires an event only WebGPU acts on), so the old GPU buffers stayed
  allocated.
- **New** (`engine/tissues/solid-sections.ts`): `geometry.dispose()` is called before the larger
  attributes are set. The geometry is re-uploaded on the next render; output is unchanged.
- **Standard**: three.js disposal practice ("How to dispose of objects", three.js manual): GPU
  resources are freed by calling `dispose()` on the geometry.
