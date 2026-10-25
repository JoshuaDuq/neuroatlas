// Fails when the gzipped Bits UI wrappers plus the Svelte runtime exceed the budget in
// web/docs/decisions/0001-ui-kit.md (method: build an entry that mounts the wrappers,
// then `gzip -9`). Run from the repository root after `npm ci --prefix web`.
//
// The entry imports every Bits UI wrapper in web/src/lib/ui (the .svelte files that import
// bits-ui) and keeps them reachable, so the measure is what the app ships. New wrappers
// are picked up automatically.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUDGET_BYTES = 85_000;
const web = resolve('web');
const uiDir = resolve(web, 'src/lib/ui');
const wrappers = readdirSync(uiDir)
  .filter((name) => name.endsWith('.svelte') && /from ['"]bits-ui['"]/.test(readFileSync(resolve(uiDir, name), 'utf8')))
  .sort()
  .map((name) => resolve(uiDir, name));
if (wrappers.length === 0) throw new Error(`No bits-ui wrappers found in ${uiDir}`);

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
          ? `${wrappers.map((file, i) => `import W${i} from ${JSON.stringify(file)};`).join('')}
             globalThis.__uiWrappers = [${wrappers.map((_, i) => `W${i}`).join(',')}];`
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
