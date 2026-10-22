import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DIFFUSION_TEXT } from './translations.js';

const source = await readFile(new URL('./native-ui.js', import.meta.url), 'utf8');
const markup = source.match(/const MARKUP = `([\s\S]*?)`;/)[1];

test('the Tracts list opens on data: a search head with its keycap, then the counted caption and the rows', () => {
  assert.match(markup, /<kbd class="search-shortcut" aria-hidden="true">\/<\/kbd>/);
  assert.ok(markup.indexOf('data-native-copy="bundles"') < markup.indexOf('id="native-tract-bundles"'));
  assert.match(markup, /id="native-tract-count"/);
  for (const key of ['loadHint', 'nativeHint']) assert.equal(DIFFUSION_TEXT.en[key], undefined, key);
});

test('display settings and sources are L2 sections, and About opens on the reference brain', () => {
  assert.equal(markup.match(/<details[^>]*class="detail-section /g).length, 2);
  const about = markup.slice(markup.indexOf('diffusion-about'));
  assert.match(about, /^[^]*?<summary[^>]*><\/summary>\s*<p[^>]*data-native-copy="nativeReference"/);
});
