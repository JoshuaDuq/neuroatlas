# E4a deviation: a failed older cut-atlas request does not roll back a newer choice

Chunk E4a (#27). A fix under the parity policy. Pinned by `sections.test.ts` ("a failed older cut
atlas does not overwrite a newer choice").

- **Legacy** (`viewer/slices/sections.js`, `setCutAtlas`): on failure it restored `previous`
  unconditionally. With `setCutAtlas('hcp-mmp')` failing after `setCutAtlas('nextbrain')` had
  succeeded, `state.cutAtlas` went back to the first call's previous value, the cut drew
  `nextbrain`, and `status` was `error`: the control named an atlas the cut was not showing.
- **New**: the state is restored and the failure reported only when the failing request is still
  the latest (`request === this.requestNumber`); a stale failure still rejects its own promise.
- **Standard**: the method's own contract (the control must not show an atlas that did not load),
  and the general rule that a superseded asynchronous request must not write state (latest-wins,
  as `setMode` already does).
