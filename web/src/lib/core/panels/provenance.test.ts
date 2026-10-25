import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { provenanceRows, referenceRows, shortUrl, type ProvenanceRow } from './provenance.ts';

const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const urls = {
  manifestUrl: '/neuroatlas/models/cdmd/manifest.json',
  indexUrl: '/neuroatlas/models/anatomies.json',
};

const items = (rows: ProvenanceRow[]) => rows.flatMap((row) => row.items);
const hrefs = (rows: ProvenanceRow[]) =>
  items(rows)
    .map((item) => item.link?.href)
    .filter(Boolean);

test('every link in the provenance sheet comes from the published records', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const published = JSON.stringify(manifest);
  // A path the manifest publishes relative to itself is still one of its records.
  const beside = urls.manifestUrl.replace(/[^/]*$/, '');
  for (const href of hrefs(rows) as string[]) {
    const relative =
      href.startsWith(beside) && published.includes(`"${href.slice(beside.length)}"`);
    assert.ok(
      published.includes(href) || relative || Object.values(urls).includes(href),
      `${href} is not in the manifest`,
    );
  }
  const cabNp = manifest.cab_np as unknown as { license_file: string };
  assert.ok(hrefs(rows).includes(`${beside}${cabNp.license_file}`));
  const hcp = manifest.atlases.find((atlas) => atlas.id === 'hcp-mmp')!;
  assert.ok(hrefs(rows).includes(`${beside}${hcp.license_file}`));
  assert.ok(hrefs(rows).includes(manifest.anatomy.source_url));
  assert.ok(hrefs(rows).includes(urls.manifestUrl));
  assert.ok(hrefs(rows).includes(urls.indexUrl));
});

test('the sheet names the subject, its reconstruction and each atlas citation', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const texts = items(rows).map((item) => item.text);
  assert.ok(texts.includes(manifest.anatomy.display_name));
  assert.ok(texts.includes(manifest.anatomy.reconstruction));
  for (const atlas of manifest.atlases) assert.ok(hrefs(rows).includes(atlas.citation), atlas.id);
  const functional = manifest.functional_regions as unknown as { citations: string[] };
  for (const citation of functional.citations) {
    assert.ok(hrefs(rows).includes(citation), citation);
  }
  const files = rows.find((row) => row.label === 'Published files')!;
  const sources = (manifest.provenance as { sources: unknown[] }).sources;
  assert.match(files.items[0].note!, new RegExp(`^${sources.length} source files`));
});

test('absent fields leave no empty rows and invent nothing', () => {
  const rows = provenanceRows(
    { anatomy: { display_name: 'X “1”' } as Manifest['anatomy'] },
    { lang: 'fr' },
  );
  assert.deepEqual(
    rows.map((row) => row.label),
    ['Sujet'],
  );
  assert.equal(rows[0].items[0].note, null, 'no kind is claimed without the individual flag');
});

test('labels are translated; the data is not', () => {
  const en = provenanceRows(manifest, { lang: 'en', ...urls }).map((row) => row.label);
  const fr = provenanceRows(manifest, { lang: 'fr', ...urls }).map((row) => row.label);
  assert.equal(en.length, fr.length);
  assert.notDeepEqual(en, fr);
  const reconstruction = (lang: 'en' | 'fr') =>
    items(provenanceRows(manifest, { lang, ...urls })).find((item) => item.mono)?.text;
  assert.equal(reconstruction('fr'), reconstruction('en'));
});

test('a tract reference lists its own sources, not the hidden anatomy', () => {
  const rows = referenceRows(
    { label: 'SNAIL reference', links: [{ href: 'https://example.org/a', text: 'A' }] },
    'en',
  );
  assert.equal(rows[0].items[0].text, 'SNAIL reference');
  assert.deepEqual(rows[1].items, [{ link: { href: 'https://example.org/a', text: 'A' } }]);
});

test('URLs read without their scheme', () => {
  assert.equal(shortUrl('https://doi.org/10.1/x'), 'doi.org/10.1/x');
  assert.equal(shortUrl('https://www.z-anatomy.com/'), 'www.z-anatomy.com');
});
