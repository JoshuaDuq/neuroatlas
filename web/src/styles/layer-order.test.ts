/// <reference types="node" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build, type Rollup } from 'vite';
import { afterAll, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('../../', import.meta.url));
const indexCss = fileURLToPath(new URL('./index.css', import.meta.url));
const scratchParent = join(webRoot, 'node_modules/.cache');
mkdirSync(scratchParent, { recursive: true });
const scratch = mkdtempSync(join(scratchParent, 'u1-layer-order-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// A component whose <style> is in `features`, bundled the way main.ts bundles the app.
writeFileSync(
  join(scratch, 'Probe.svelte'),
  '<h1>Probe</h1>\n<style>\n  @layer features {\n    h1 { margin: 5px; }\n  }\n</style>\n',
);
writeFileSync(
  join(scratch, 'entry.ts'),
  `import ${JSON.stringify(indexCss)};\nimport Probe from './Probe.svelte';\nconsole.log(Probe);\n`,
);

it('a component <style> in @layer features lands after the layer statement in the built CSS', async () => {
  const output = (await build({
    root: scratch,
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte()],
    build: { write: false, lib: { entry: join(scratch, 'entry.ts'), formats: ['es'] } },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const assets = [output].flat().flatMap(({ output: files }) => files);
  const css = assets
    .filter(
      (file): file is Rollup.OutputAsset => file.type === 'asset' && file.fileName.endsWith('.css'),
    )
    .map((file) => String(file.source))
    .join('');
  const order = [...css.matchAll(/@layer ([a-z0-9, ]+?)\s*[{;]/g)].flatMap(([, names]) =>
    names.split(/\s*,\s*/),
  );
  const firstSeen = [...new Set(order)];
  expect(firstSeen).toEqual(['tokens', 'base', 'elements', 'components', 'features', 'a11y']);
  expect(css).toMatch(/@layer features\s*\{h1\.svelte-/);
});
