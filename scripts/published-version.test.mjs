import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import test from 'node:test';
import { publishedFiles, publishedRecord } from './published-version.mjs';

function publishedTree(t) {
  const directory = mkdtempSync(join(tmpdir(), 'planum-version-'));
  t.after(() => rmSync(directory, { recursive: true }));
  for (const name of ['models/bert', 'diffusion', 'assets']) mkdirSync(join(directory, name), { recursive: true });
  writeFileSync(join(directory, 'models', 'bert', 'anatomy.glb'), 'anatomy');
  writeFileSync(join(directory, 'models', 'bert', 'validation.json'), '{}');
  writeFileSync(join(directory, 'diffusion', 'bundle.trk.gz'), gzipSync('tract'));
  writeFileSync(join(directory, 'assets', 'index.js'), 'code');
  return directory;
}

const sha256 = text => createHash('sha256').update(text).digest('hex');

test('every published file gets its own hash, version and decoded size', t => {
  const files = publishedFiles(publishedTree(t));
  assert.deepEqual(Object.keys(files).sort(),
    ['diffusion/bundle.trk.gz', 'models/bert/anatomy.glb', 'models/bert/validation.json']);
  assert.deepEqual(files['models/bert/anatomy.glb'],
    { version: sha256('anatomy').slice(0, 16), sha256: sha256('anatomy'), size: 7 });
});

test('changing one file changes that file’s version and no other', t => {
  const directory = publishedTree(t);
  const before = publishedFiles(directory);
  writeFileSync(join(directory, 'models', 'bert', 'validation.json'), '{"checked":true}');
  const after = publishedFiles(directory);
  assert.notEqual(after['models/bert/validation.json'].version, before['models/bert/validation.json'].version);
  assert.deepEqual(after['models/bert/anatomy.glb'], before['models/bert/anatomy.glb']);
  assert.deepEqual(after['diffusion/bundle.trk.gz'], before['diffusion/bundle.trk.gz']);
  assert.deepEqual(publishedRecord(directory, 'models/bert/validation.json'), after['models/bert/validation.json']);
});

test('identical published files have the same versions in different checkouts', t => {
  assert.deepEqual(publishedFiles(publishedTree(t)), publishedFiles(publishedTree(t)));
});

test('a gzip file also records the contents a decoding server hands over', t => {
  const record = publishedFiles(publishedTree(t))['diffusion/bundle.trk.gz'];
  assert.deepEqual(record.gunzipped, { sha256: sha256('tract'), size: 5 });
  assert.notEqual(record.sha256, record.gunzipped.sha256);
});
