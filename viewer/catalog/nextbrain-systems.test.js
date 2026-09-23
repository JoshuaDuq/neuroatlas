import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { nextbrainSystem } from './nextbrain-systems.js';

const models = new URL('../../public/models/', import.meta.url);
const { anatomies } = JSON.parse(await readFile(new URL('anatomies.json', models), 'utf8'));

// A subject segmentation can carry labels the MNI volume never had, and a
// region without a system would throw when the catalog files it.
for (const { id } of anatomies) {
  test(`every published NextBrain region of ${id} belongs to an anatomical system`, async () => {
    const manifest = JSON.parse(await readFile(new URL(`${id}/manifest.json`, models), 'utf8'));
    const regions = manifest.regions.filter(region => region.atlas === 'nextbrain');
    for (const region of regions) {
      assert.doesNotThrow(() => nextbrainSystem(region), region.id);
      assert.ok(nextbrainSystem(region, 'fr'), region.id);
    }
  });
}
