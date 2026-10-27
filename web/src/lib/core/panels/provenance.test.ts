import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import type { NeuropsychDomains } from '../catalog/neuropsych-domains.ts';
import {
  checkedParcels,
  provenanceRows,
  referenceRows,
  shortUrl,
  type ProvenanceRow,
} from './provenance.ts';

const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const domains = readRepoJson<NeuropsychDomains>('public/models/cdmd/neuropsych-domains.json');
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

const published = (lang: 'en' | 'fr') => provenanceRows(manifest, { lang, ...urls, domains });
const rowOf = (rows: ProvenanceRow[], label: string) => rows.find((row) => row.label === label)!;

test('PROV-01 the published cdmd manifest gives one row per record, in order', () => {
  assert.deepEqual(
    published('en').map((row) => row.label),
    [
      'Subject',
      'Source data',
      'Reconstruction',
      'Cortical atlases',
      'Functional networks',
      'Functional divisions',
      'Neuropsychological domains',
      'Supplemental layers',
      'Published files',
    ],
  );
  assert.deepEqual(provenanceRows({}), []);
  const supplemental = rowOf(published('en'), 'Supplemental layers').items;
  assert.deepEqual(supplemental, [
    {
      text: 'Z-Anatomy spinal cord reference',
      note: 'CC BY-SA 4.0 · Z-Anatomy, after BodyParts3D (CC BY-SA 2.1 JP)',
      link: { href: 'https://www.z-anatomy.com/', text: 'www.z-anatomy.com' },
    },
  ]);
  const licences = items(published('en'))
    .filter((item) => item.link?.mono && item.link.href.includes('/licenses/'))
    .map((item) => item.link!.href);
  assert.deepEqual(licences, [
    '/neuroatlas/models/cdmd/../licenses/HCP-Data-Use-Terms.txt',
    '/neuroatlas/models/cdmd/../licenses/CAB-NP.txt',
  ]);
});

test('PROV-03 the subject, its reconstruction and the source files are named in both languages', () => {
  const en = published('en');
  assert.deepEqual(rowOf(en, 'Subject').items, [
    { text: 'MGH CDMD “sub_013”', note: 'One individual’s MRI reconstruction' },
  ]);
  assert.deepEqual(rowOf(en, 'Reconstruction').items, [
    { text: 'freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45', mono: true },
  ]);
  assert.deepEqual(
    rowOf(en, 'Published files').items.map((item) => [item.link!.text, item.note]),
    [
      ['manifest.json', '39 source files, each with a SHA-256 checksum'],
      ['anatomies.json', 'Index of the published anatomies'],
    ],
  );
  const fr = published('fr');
  assert.equal(rowOf(fr, 'Sujet').items[0].note, 'Reconstruction IRM d’un individu');
  assert.equal(rowOf(fr, 'Fichiers publiés').items[1].note, 'Index des anatomies publiées');
});

test('PROV-04 HCP-MMP says it was projected from fsaverage, and Destrieux says nothing', () => {
  const atlases = (lang: 'en' | 'fr') =>
    rowOf(published(lang), lang === 'en' ? 'Cortical atlases' : 'Atlas corticaux').items;
  assert.equal(atlases('en')[0].text, 'Destrieux anatomical atlas');
  assert.equal(atlases('en')[0].note, null);
  assert.equal(atlases('en')[1].text, 'HCP-MMP1.0 multimodal atlas');
  assert.equal(atlases('en')[1].note, 'Projected from fsaverage');
  assert.equal(atlases('fr')[1].note, 'Projeté depuis fsaverage');
});

test('PROV-05 each domain lists how much of every lesion-mapped parcel its areas colour', () => {
  const domainItems = rowOf(published('en'), 'Neuropsychological domains').items;
  const text = (label: string) => domainItems.find((item) => item.text === label)!.note;
  assert.equal(
    text('Executive functions: “executive function”'),
    'Lesion check: Executive dysfunction (Gläscher et al. 2012): G_front_middle (L) 13% coloured, G_front_middle (R) 18% coloured, G_and_S_cingul-Ant (L) 0% coloured, G_and_S_cingul-Ant (R) 8% coloured.',
  );
  assert.equal(
    text('Pain: “pain”'),
    'Lesion check: Central post-stroke pain (Sprenger et al. 2012): caudal_division_of_ventral_posterior_lateral_nucleus (L), not measured, caudal_division_of_ventral_posterior_lateral_nucleus (R), not measured, anterior_nucleus_of_pulvinar (L), not measured, anterior_nucleus_of_pulvinar (R), not measured.',
  );
  assert.equal(
    text('Working memory: “working memory”'),
    'No lesion study in Planum’s deficit evidence checks this domain.',
  );
  const unchecked = domainItems.filter((item) => item.note?.startsWith('No lesion study'));
  assert.equal(unchecked.length, 26);
  const [executive] = domains.lesion_checks.executive as Parameters<typeof checkedParcels>[0][];
  assert.equal(
    checkedParcels(executive, 'fr'),
    'G_front_middle (G) colorée à 13\u202f%, G_front_middle (D) colorée à 18\u202f%, G_and_S_cingul-Ant (G) colorée à 0\u202f%, G_and_S_cingul-Ant (D) colorée à 8\u202f%',
  );
  const midline = {
    ...executive,
    mappings: [
      { region: 'destrieux:midline:1', source_name: 'M', coverage: 0.5 },
      { region: 'destrieux:left:1', source_name: 'N', coverage: null },
    ],
  };
  assert.equal(checkedParcels(midline, 'fr'), 'M (Méd) colorée à 50\u202f%, N (G), non mesurée');
});

test('PROV-07 a tract reference with no source links has no Sources row, in either language', () => {
  const reference = { label: 'SNAIL reference', links: [] };
  assert.deepEqual(referenceRows(reference, 'en'), [
    { label: 'Tract reference', items: [{ text: 'SNAIL reference' }] },
  ]);
  assert.deepEqual(referenceRows(reference, 'fr'), [
    { label: 'Référence des faisceaux', items: [{ text: 'SNAIL reference' }] },
  ]);
  const linked = { label: 'R', links: [{ href: 'https://example.org/a', text: 'A' }] };
  assert.equal(referenceRows(linked, 'en')[1].label, 'Sources');
  assert.equal(referenceRows(linked)[0].label, 'Tract reference', 'English by default');
});

test('PROV-08 only the http and https schemes and a trailing slash are dropped', () => {
  assert.equal(shortUrl('http://a.b/'), 'a.b');
  assert.equal(shortUrl('ftp://x/'), 'ftp://x');
  assert.equal(shortUrl(''), '');
  const files = rowOf(published('en'), 'Published files').items;
  assert.deepEqual(
    files.map((item) => [item.link!.mono, item.link!.text]),
    [
      [true, 'manifest.json'],
      [true, 'anatomies.json'],
    ],
  );
});
