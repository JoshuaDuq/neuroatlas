import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createProvenance, provenanceRows, referenceRows, shortUrl } from './provenance.js';

const manifest = JSON.parse(await readFile(new URL('../../../public/models/cdmd/manifest.json', import.meta.url), 'utf8'));
const urls = { manifestUrl: '/neuroatlas/models/cdmd/manifest.json', indexUrl: '/neuroatlas/models/anatomies.json' };

const items = rows => rows.flatMap(row => row.items);
const hrefs = rows => items(rows).map(item => item.link?.href).filter(Boolean);

test('every link in the provenance sheet comes from the published records', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const published = JSON.stringify(manifest);
  // A path the manifest publishes relative to itself is still one of its records.
  const beside = urls.manifestUrl.replace(/[^/]*$/, '');
  for (const href of hrefs(rows)) {
    const relative = href.startsWith(beside) && published.includes(`"${href.slice(beside.length)}"`);
    assert.ok(published.includes(href) || relative || Object.values(urls).includes(href),
      `${href} is not in the manifest`);
  }
  assert.ok(hrefs(rows).includes(`${beside}${manifest.cab_np.license_file}`));
  const hcp = manifest.atlases.find(atlas => atlas.id === 'hcp-mmp');
  assert.ok(hrefs(rows).includes(`${beside}${hcp.license_file}`));
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
  for (const citation of manifest.functional_regions.citations) assert.ok(hrefs(rows).includes(citation), citation);
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

test('provenance opens and closes immediately for keyboard activation and Escape', t => {
  const previous = globalThis.document;
  const nodes = new Map();
  const element = () => {
    const node = new EventTarget();
    const attributes = new Set();
    node.replaceChildren = () => {};
    node.toggleAttribute = (name, force) => force ? attributes.add(name) : attributes.delete(name);
    node.hasAttribute = name => attributes.has(name);
    return node;
  };
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const open = element();
  const dialog = byId('provenance-dialog');
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  globalThis.document = {
    getElementById: byId,
    querySelectorAll: () => [open],
    activeElement: open,
  };
  const provenance = createProvenance({ manifest: {} });
  t.after(() => { provenance.dispose(); globalThis.document = previous; });
  const click = (node, detail) => {
    const event = new Event('click');
    Object.defineProperty(event, 'detail', { value: detail });
    node.dispatchEvent(event);
  };

  click(open, 0);
  assert.equal(dialog.open, true);
  assert.equal(dialog.hasAttribute('data-instant'), true);
  click(byId('provenance-close'), 0);
  assert.equal(dialog.open, false);
  assert.equal(dialog.hasAttribute('data-instant'), true);

  click(open, 1);
  assert.equal(dialog.hasAttribute('data-instant'), false, 'pointer activation restores the dialog transition');
  dialog.dispatchEvent(new Event('cancel'));
  assert.equal(dialog.hasAttribute('data-instant'), true, 'native Escape dismissal remains immediate');
});
