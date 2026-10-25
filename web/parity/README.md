# Parity tests

Two kinds of test compare the Svelte app with the legacy viewer, and both are deleted at the
cutover, when `viewer/` goes.

## Numerical parity: `web/parity/<chunk>.test.ts`

Run by the `unit` Vitest project (`npm run test:parity` runs only these). A chunk's test imports
the legacy module from `viewer/` beside the new TypeScript module and asserts that both return
the same values for the same inputs, for example:

```ts
import { decodeState } from '../../viewer/state/url-state.js';
import { decodeLink } from '../src/lib/core/link/url-state.ts';
```

`vitest.config.ts` resolves `three`, `three-mesh-bvh`, `@niivue/niivue` and `yaml` with
`resolve.dedupe`, so the legacy modules and `web/` share one Three.js instance (two copies would
break `instanceof` checks and the shared renderer state). `server.fs.allow` includes the
repository root so `viewer/` and `public/` are readable. Run `npm ci` at the repository root as
well as in `web/`, or the legacy modules cannot resolve their dependencies.

Where the legacy behaviour is a bug and the new code deliberately differs, the test asserts the
corrected behaviour and cites `web/docs/decisions/deviations/<chunk>-<slug>.md`.

Data-contract tests read repository files through `web/test/repo.ts` (`repoRoot`, `readRepoJson`,
`readRepoYaml`) rather than hand-written `../../../` paths.

## Browser parity: `web/e2e/parity/<feature>.spec.ts`

Playwright runs each spec twice, as the projects `legacy` (`/neuroatlas/`) and `next`
(`/neuroatlas/next/`), against the assembled site served by `e2e/serve-site.mjs`:

```sh
npm run build                                                  # repository root
npm run build:preview -- --outDir ../dist/next --emptyOutDir   # web/
npm run test:e2e                                               # web/
```

Specs import `test` and `expect` from `e2e/fixtures.ts`, which is frozen: feature helpers go in
`e2e/parity/<feature>.helpers.ts`. A feature's spec checks accessibility with
`app.expectAccessible('<feature>')`; the legacy result is recorded in
`e2e/a11y-baseline/<feature>.legacy.json` (`A11Y_BASELINE=1`, information only) and `next` must
have no violations. The region gates `e2e/parity/enabled/{panels,stage,shell}.ts` each export
`false` until the chunk that owns the region (I1, I2, I3b) flips it; specs for that region run
only when its gate is `true`.
