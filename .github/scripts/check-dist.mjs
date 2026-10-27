// Checks the built site in web/dist (after `npm run build:preview --prefix web`, from the repository
// root): the chunks, the page's head and the service worker's version map. BUILD-04, BUILD-05 and
// BUILD-06 in web/docs/testing/rules/boot-and-assets.md. It fails if dist/index.html is absent.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const dist = resolve('web/dist');
const published = resolve('public');
const indexPath = resolve(dist, 'index.html');
assert.ok(existsSync(indexPath), `${indexPath} is missing: build the site first`);

// BUILD-04: Three.js core and the BVH index are chunks of their own.
const chunk = (name) => {
  const matches = readdirSync(resolve(dist, 'assets')).filter((file) =>
    new RegExp(`^${name}-[\\w-]+\\.js$`).test(file),
  );
  assert.equal(matches.length, 1, `exactly one ${name} chunk, found ${matches}`);
  return readFileSync(resolve(dist, 'assets', matches[0]), 'utf8');
};
assert.ok(chunk('three').includes('WebGLRenderer'), 'the three chunk holds WebGLRenderer');
assert.ok(chunk('bvh').includes('MeshBVH'), 'the bvh chunk holds MeshBVH');

// BUILD-06: the charset within the first 1024 bytes, the prefetch script ahead of the stylesheet.
const html = readFileSync(indexPath);
const text = html.toString('utf8');
assert.ok(
  html.subarray(0, 1024).toString('utf8').includes('<meta charset="UTF-8"'),
  'charset first',
);
const script = text.indexOf('window.__planumAssets');
assert.ok(script > -1, 'the prefetch script is inlined');
assert.ok(script < text.indexOf('rel="stylesheet"'), 'the prefetch script precedes the stylesheet');

// BUILD-07 and BUILD-05: the head map holds models/ versions only.
const head = JSON.parse(text.match(/var versions = (.*);$/m)[1]);
assert.ok(Object.keys(head).length > 0, 'the head map is not empty');
assert.ok(
  Object.keys(head).every((path) => path.startsWith('models/')),
  'the head map is models/ only',
);
assert.ok(!text.includes('__PUBLISHED_VERSIONS__') && !text.includes('__ASSET_BASE__'));

// BUILD-05: sw.js beside the bundle, with {base, files, gunzipped} of published files.
const worker = readFileSync(resolve(dist, 'sw.js'), 'utf8');
assert.ok(worker.includes('planum-models'));
const map = JSON.parse(worker.match(/^const PUBLISHED = (.*);$/m)[1]);
assert.deepEqual(Object.keys(map), ['base', 'files', 'gunzipped']);
assert.equal(map.base, '/neuroatlas/');
for (const [path, version] of Object.entries(map.files)) {
  assert.match(version, /^[0-9a-f]{16}$/, path);
  assert.ok(existsSync(resolve(published, path)), `${path} is published`);
}
// Every published file is mapped: the keys equal a directory walk of the published trees.
const walk = (directory) =>
  readdirSync(resolve(published, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `${directory}/${relative(resolve(published, directory), resolve(entry.parentPath, entry.name)).split(sep).join('/')}`,
    );
assert.deepEqual(Object.keys(map.files).sort(), [...walk('models'), ...walk('diffusion')].sort());
for (const [path, version] of Object.entries(map.gunzipped)) {
  assert.ok(path.endsWith('.gz'), path);
  assert.match(version, /^[0-9a-f]{16}$/, path);
}
for (const [path, version] of Object.entries(head)) assert.equal(map.files[path], version, path);
console.log(
  `dist ok: ${Object.keys(map.files).length} published files, ${Object.keys(head).length} in the head map`,
);
