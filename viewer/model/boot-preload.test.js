import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The preload script in `index.html` starts the anatomy download before the
 * module graph has parsed, so it cannot import anything and has to name the
 * files itself. That makes it a second copy of knowledge the manifest and the
 * build config already hold, and the copy that is wrong is the expensive one:
 * a stale name sends tens of megabytes to a 404, and a stale base sends them
 * to the site root.
 *
 * These checks hold the live script to the other two rather than to a
 * transcription of itself.
 */

const read = async name =>
  readFile(new URL(`../../${name}`, import.meta.url), 'utf8');

const boot = async () => {
  const html = await read('index.html');
  const script = html.match(/window\.__neuroatlasAssets[\s\S]*?\}\)\(\);/);
  assert.ok(script, 'index.html has no preload script');
  return script[0];
};

test('the preload script fetches from the same base the build publishes under', async () => {
  const configured = (await read('vite.config.js')).match(/\bbase\s*[:=]\s*'([^']+)'/);
  assert.ok(configured, 'vite.config.js declares no base');
  const used = (await boot()).match(/var root = '([^']+)'/);
  assert.ok(used, 'the preload script hardcodes no root');
  assert.equal(used[1], configured[1]);
});

test('every layer the preload script names is one the manifest publishes', async () => {
  const script = await boot();
  const published = JSON.parse(await read('public/models/anatomies.json'));
  const manifest = JSON.parse(
    await read(`public/models/${published.default}/manifest.json`),
  );
  const known = new Set([
    ...manifest.atlases.map(entry => entry.file),
    ...manifest.detail_levels.map(entry => entry.file),
    ...(manifest.supplemental_layers ?? []).map(entry => entry.file),
  ]);
  const named = script.match(/'[\w-]+\.glb'/g) ?? [];
  assert.ok(named.length >= 2, 'the preload script names no layer files');
  for (const quoted of named) {
    const file = quoted.slice(1, -1);
    assert.ok(known.has(file), `preload names an unpublished layer: ${file}`);
  }
});

test('the preload script offers every atlas and detail level a link can ask for', async () => {
  // A shared link naming a layer the script does not know still works, but
  // its download starts a module graph later instead of immediately.
  const script = await boot();
  const published = JSON.parse(await read('public/models/anatomies.json'));
  const manifest = JSON.parse(
    await read(`public/models/${published.default}/manifest.json`),
  );
  for (const level of manifest.detail_levels) {
    assert.ok(
      script.includes(`${level.id}:`) || script.includes(`'${level.file}'`),
      `preload cannot start the ${level.id} detail level`,
    );
  }
  for (const atlas of manifest.atlases) {
    assert.ok(
      script.includes(`'${atlas.file}'`),
      `preload cannot start the ${atlas.id} atlas`,
    );
  }
});

test('the default brain is read from the index rather than assumed', async () => {
  // Region ids are shared between brains, so guessing here would open the
  // right region on whichever anatomy happened to load.
  const script = await boot();
  assert.match(script, /models\/anatomies\.json/);
  assert.match(script, /published\.default/);
});

test('the preload script asks for each file at the version the build publishes for it', async () => {
  const script = (await read('index.html')).match(/<script>\s*(window\.__neuroatlasAssets[\s\S]*?\}\)\(\);)\s*<\/script>/)[1];
  const versions = {
    'models/anatomies.json': 'index0000000000a', 'models/bert/manifest.json': 'manifest00000000',
    'models/bert/cortex-hcp-mmp.glb': 'hcp0000000000000', 'models/bert/nextbrain.glb': 'fine000000000000',
  };
  const requested = [];
  const window = {};
  const location = { hash: '#anatomy=bert&atlas=hcp-mmp&detail=nextbrain', origin: 'https://example.org' };
  const fetch = async url => { requested.push(url); return new Response('{}'); };
  new Function('window', 'location', 'fetch', script.replace('__PUBLISHED_VERSIONS__', JSON.stringify(versions)))(
    window, location, fetch);
  assert.deepEqual(requested.sort(), [
    'https://example.org/neuroatlas/models/anatomies.json?v=index0000000000a',
    'https://example.org/neuroatlas/models/bert/cortex-hcp-mmp.glb?v=hcp0000000000000',
    'https://example.org/neuroatlas/models/bert/manifest.json?v=manifest00000000',
    'https://example.org/neuroatlas/models/bert/nextbrain.glb?v=fine000000000000',
  ]);
  assert.deepEqual(Object.keys(window.__neuroatlasAssets).sort(), requested.map(url => url.split('?')[0]).sort());
});

test('the first frame does not wait for the tissue envelopes or the cord', async () => {
  const script = await boot();
  const published = JSON.parse(await read('public/models/anatomies.json'));
  const manifest = JSON.parse(await read(`public/models/${published.default}/manifest.json`));
  for (const file of [manifest.solid_envelopes.file, ...(manifest.supplemental_layers ?? []).map(layer => layer.file)]) {
    assert.ok(!script.includes(file), `preload starts ${file}`);
  }
});
