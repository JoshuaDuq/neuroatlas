import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { provenanceRows, referenceRows, shortUrl } from './provenance.js';

const manifest = JSON.parse(await readFile(new URL('../../public/models/snail/manifest.json', import.meta.url), 'utf8'));
const urls = { manifestUrl: '/neuroatlas/models/snail/manifest.json', indexUrl: '/neuroatlas/models/anatomies.json' };

const items = rows => rows.flatMap(row => row.items);
const hrefs = rows => items(rows).map(item => item.link?.href).filter(Boolean);

test('every link in the provenance sheet comes from the published records', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const published = JSON.stringify(manifest);
  for (const href of hrefs(rows)) {
    assert.ok(published.includes(href) || Object.values(urls).includes(href), `${href} is not in the manifest`);
  }
  assert.ok(hrefs(rows).includes(manifest.anatomy.source_url));
  assert.ok(hrefs(rows).includes(urls.manifestUrl));
  assert.ok(hrefs(rows).includes(urls.indexUrl));
});

test('the sheet names the subject, its reconstruction and each atlas citation', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const texts = items(rows).map(item => item.text);
  assert.ok(texts.includes(manifest.anatomy.display_name));
  assert.ok(texts.includes(manifest.anatomy.reconstruction));
  for (const atlas of manifest.atlases) assert.ok(hrefs(rows).includes(atlas.citation), atlas.id);
  const files = rows.find(row => row.label === 'Published files');
  assert.match(files.items[0].note, new RegExp(`^${manifest.provenance.sources.length} source files`));
});

test('absent fields leave no empty rows and invent nothing', () => {
  const rows = provenanceRows({ anatomy: { display_name: 'X “1”' } }, { lang: 'fr' });
  assert.deepEqual(rows.map(row => row.label), ['Sujet']);
  assert.equal(rows[0].items[0].note, null, 'no kind is claimed without the individual flag');
});

test('labels are translated; the data is not', () => {
  const en = provenanceRows(manifest, { lang: 'en', ...urls }).map(row => row.label);
  const fr = provenanceRows(manifest, { lang: 'fr', ...urls }).map(row => row.label);
  assert.equal(en.length, fr.length);
  assert.notDeepEqual(en, fr);
  const reconstruction = lang => items(provenanceRows(manifest, { lang, ...urls }))
    .find(item => item.mono)?.text;
  assert.equal(reconstruction('fr'), reconstruction('en'));
});

test('a tract reference lists its own sources, not the hidden anatomy', () => {
  const rows = referenceRows({ label: 'SNAIL reference', links: [{ href: 'https://example.org/a', text: 'A' }] }, 'en');
  assert.equal(rows[0].items[0].text, 'SNAIL reference');
  assert.deepEqual(rows[1].items, [{ link: { href: 'https://example.org/a', text: 'A' } }]);
});

test('URLs read without their scheme', () => {
  assert.equal(shortUrl('https://doi.org/10.1/x'), 'doi.org/10.1/x');
  assert.equal(shortUrl('https://www.z-anatomy.com/'), 'www.z-anatomy.com');
});
