import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { publishedVersion } from './published-version.mjs';

function publishedFiles(t) {
  const directory = mkdtempSync(join(tmpdir(), 'neuroatlas-version-'));
  t.after(() => rmSync(directory, { recursive: true }));
  for (const name of ['models', 'diffusion']) mkdirSync(join(directory, name));
  writeFileSync(join(directory, 'models', 'anatomy.glb'), 'anatomy');
  writeFileSync(join(directory, 'diffusion', 'bundle.trk.gz'), 'tract');
  return directory;
}

test('changing anatomy or diffusion bytes invalidates the published version', t => {
  const directory = publishedFiles(t);
  const original = publishedVersion(directory);
  writeFileSync(join(directory, 'diffusion', 'bundle.trk.gz'), 'updated tract');
  const diffusionChanged = publishedVersion(directory);
  assert.notEqual(diffusionChanged, original);
  writeFileSync(join(directory, 'models', 'anatomy.glb'), 'updated anatomy');
  assert.notEqual(publishedVersion(directory), diffusionChanged);
});

test('identical published files have the same version in different checkouts', t => {
  assert.equal(publishedVersion(publishedFiles(t)), publishedVersion(publishedFiles(t)));
});
