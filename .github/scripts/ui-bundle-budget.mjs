// Fails when the gzipped Bits UI wrappers plus the Svelte runtime exceed the budget in
// web/docs/decisions/0001-ui-kit.md (method: build an entry that mounts the wrappers,
// then `gzip -9`). Run from the repository root after `npm ci --prefix web`.
//
// The entry is the U0 spike fixture, which mounts every Bits UI part. Once U3-U7 land,
// switch it to the wrappers in web/src/lib/ui. UI_BUDGET_ENTRY overrides it for probes.
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUDGET_BYTES = 85_000;
const web = resolve('web');
const entry = resolve(web, process.env.UI_BUDGET_ENTRY ?? 'docs/decisions/kit-spike/Spike.svelte');

const require = createRequire(`${web}/package.json`);
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { svelte } = await import(pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte')));

const virtualEntry = '\0ui-budget-entry';
const result = await build({
  root: web,
  configFile: false,
  logLevel: 'warn',
  plugins: [
    svelte(),
    {
      name: 'ui-budget-entry',
      resolveId: (id) => (id === virtualEntry ? id : null),
      load: (id) =>
        id === virtualEntry
          ? `import { mount } from 'svelte'; import Entry from ${JSON.stringify(entry)}; mount(Entry, { target: document.body });`
          : null,
    },
  ],
  build: {
    write: false,
    minify: true,
    target: 'es2022',
    rolldownOptions: { input: virtualEntry },
  },
});

const { output } = Array.isArray(result) ? result[0] : result;
const total = output
  .filter((file) => file.type === 'chunk')
  .reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0);
console.log(`UI bundle (Bits UI + Svelte runtime): ${total} bytes gzip (budget ${BUDGET_BYTES})`);
if (total > BUDGET_BYTES) {
  console.error('Over budget: investigate before raising it (web/docs/decisions/0001-ui-kit.md).');
  process.exit(1);
}
