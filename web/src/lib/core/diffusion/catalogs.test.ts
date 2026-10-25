import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readYaml } from '../clinical/test-support.ts';
import { anatomies } from '../catalog/test-support.ts';
import { TRACT_CATALOGS, tractCatalog } from './catalogs.ts';
import type { TractCatalog } from './catalogs.ts';

const { tract_catalogs: paths } = readYaml<{ tract_catalogs: string[] }>('config/model.yaml');
const catalogs = paths.map((path) => readYaml<TractCatalog>(path));

// The legacy test read catalogs.js as text to compare its imports with config/model.yaml;
// the behavioural equivalent is that the catalogs it serves are exactly the files named there.
test('the viewer serves exactly the tract catalogs config/model.yaml names', () => {
  assert.deepEqual(TRACT_CATALOGS, catalogs);
});

test('each catalog belongs to one published anatomy and carries the same dataset copy', () => {
  const owners = catalogs.map((catalog) => catalog.anatomy);
  assert.equal(new Set(owners).size, owners.length);
  for (const anatomy of owners) {
    assert.ok(
      anatomies.anatomies.some((entry) => entry.id === anatomy),
      anatomy,
    );
  }
  const keys = Object.keys(catalogs[0].text.en).sort();
  for (const catalog of catalogs) {
    for (const lang of ['en', 'fr'] as const) {
      assert.deepEqual(Object.keys(catalog.text[lang]).sort(), keys, `${catalog.id} ${lang}`);
    }
  }
});

test('an anatomy with tracts of its own gets them, any other the CDMD reference', () => {
  assert.equal(tractCatalog('cdmd'), TRACT_CATALOGS[0]);
  assert.equal(tractCatalog('aomic'), TRACT_CATALOGS[0]);
});
