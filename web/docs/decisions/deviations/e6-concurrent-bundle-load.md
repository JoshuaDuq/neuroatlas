# E6: a bundle requested twice at once is added once

Chunk E6 (#30). A fix under the parity policy on #4.

- **Legacy** (`viewer/diffusion/native-viewer.js`, `loadBundle`): two calls for the same bundle
  while it was still downloading both passed the `bundles.has` check. Each added its own
  `LineSegments`, the second replaced the map entry, and the first stayed in the scene group
  forever, unreachable by `setVisible`, `setMinimum`, `snapshot` and `dispose`. The panel avoided
  this only by serialising its own clicks.
- **New** (`engine/diffusion/native-viewer.ts`): concurrent calls for one bundle share the one
  in-flight load, so the lines are added once. A call for an already loaded bundle still shows it,
  and a failed load is forgotten so a retry loads again.
- **Standard**: an asynchronous resource loader must be idempotent per key (the same rule legacy's
  own `createTractLoader` follows for the download). Pinned by `native-viewer.test.ts`.
