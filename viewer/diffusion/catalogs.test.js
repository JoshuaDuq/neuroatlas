import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const { tract_catalogs: paths } = parse(await readFile(new URL('config/model.yaml', root), 'utf8'));
const catalogs = await Promise.all(paths.map(async path => parse(await readFile(new URL(path, root), 'utf8'))));

test('the viewer imports exactly the tract catalogs config/model.yaml names', async () => {
  const source = await readFile(new URL('viewer/diffusion/catalogs.js', root), 'utf8');
  const imported = [...source.matchAll(/from '\.\.\/\.\.\/([^']+\.yaml)'/g)].map(match => match[1]);
  assert.deepEqual(imported, paths);
});

test('each catalog belongs to one published anatomy and carries the same dataset copy', async () => {
  const published = JSON.parse(await readFile(new URL('public/models/anatomies.json', root), 'utf8'));
  const anatomies = catalogs.map(catalog => catalog.anatomy);
  assert.equal(new Set(anatomies).size, anatomies.length);
  for (const anatomy of anatomies) assert.ok(published.anatomies.some(entry => entry.id === anatomy), anatomy);
  const keys = Object.keys(catalogs[0].text.en).sort();
  for (const catalog of catalogs) {
    for (const lang of ['en', 'fr']) assert.deepEqual(Object.keys(catalog.text[lang]).sort(), keys, `${catalog.id} ${lang}`);
  }
});
