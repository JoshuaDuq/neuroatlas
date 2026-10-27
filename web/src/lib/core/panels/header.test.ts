import assert from 'node:assert/strict';
import { test } from 'vitest';
import { t } from '../i18n/index.ts';
import {
  atlasOption,
  colophonParts,
  colourGroups,
  colourOption,
  dataSummary,
  loadingText,
  subjectName,
} from './header.ts';

test('subject names keep the dataset with the subject, without quotation marks', () => {
  assert.equal(subjectName({ id: 'snail', display_name: 'SNAIL “subj_1”' }), 'SNAIL subj_1');
  assert.equal(
    subjectName({ id: 'aomic', display_name: 'AOMIC-PIOP1 “sub-0022”' }),
    'AOMIC-PIOP1 sub-0022',
  );
  assert.equal(subjectName({ id: 'x', subject: 'x' }), 'x');
  assert.equal(subjectName({ id: 'y' }), 'y');
});

test('the data summary names available choices, or the tract reference alone', () => {
  const texts = (parts: { text: string }[]) => parts.map(({ text }) => text);
  const full = dataSummary({
    subject: 'SNAIL subj_1',
    atlas: 'Destrieux',
    colour: 'Regions',
    detail: 'Teaching set',
  });
  assert.deepEqual(texts(full), ['SNAIL subj_1', 'Destrieux', 'Regions', 'Teaching set']);
  assert.deepEqual(
    full.map(({ part }) => part),
    ['subject', 'atlas', 'colour', 'detail'],
  );
  assert.deepEqual(
    dataSummary({ subject: 'bert', atlas: 'Destrieux', colour: 'Regions', reference: 'SNAIL' }),
    [{ part: 'subject', text: 'SNAIL' }],
  );
  assert.deepEqual(texts(dataSummary({ subject: 'bert', atlas: 'Destrieux', detail: null })), [
    'bert',
    'Destrieux',
  ]);
  assert.deepEqual(
    dataSummary({ subject: null, atlas: 'Destrieux', colour: 'Regions', detail: 'Teaching set' }),
    [
      { part: 'atlas', text: 'Destrieux' },
      { part: 'colour', text: 'Regions' },
      { part: 'detail', text: 'Teaching set' },
    ],
    'an immutable subject can be omitted without adding a blank summary part',
  );
  assert.deepEqual(
    dataSummary({ atlas: 'Destrieux' }),
    [{ part: 'atlas', text: 'Destrieux' }],
    'the atlas still identifies a summary with no subject or supporting settings',
  );
});

test('the status bar keeps the not-clinical statement in every state', () => {
  const anatomy = { display_name: 'SNAIL “subj_1”', individual: true };
  for (const lang of ['en', 'fr'] as const) {
    const loading = colophonParts(lang);
    assert.equal(loading.description, '', 'no dataset is named before one is loaded');
    assert.match(loading.statement, /clinical anatomy|anatomie clinique/i);
    assert.match(
      colophonParts(lang, { anatomy }).description,
      /^SNAIL subj_1 · /,
      'named as the masthead names it',
    );
    assert.match(colophonParts(lang, { anatomy }).statement, /clinical anatomy|anatomie clinique/);
    assert.match(
      colophonParts(lang, { anatomy, reference: { label: 'Ref' } }).statement,
      /clinical anatomy|anatomie clinique/,
    );
  }
});

test('Colour groups appearance, the atlas regions and networks, with the functional divisions last', () => {
  const all = { networks: {}, cabNp: {}, functionalRegions: {} };
  assert.deepEqual(colourGroups(all), [
    ['appearance', ['tissue', 'mri']],
    ['parcellation', ['atlas']],
    ['networks', ['network', 'cab-np']],
    [null, ['functional']],
  ]);
  assert.deepEqual(
    colourGroups({ networks: {} }),
    [
      ['appearance', ['tissue', 'mri']],
      ['parcellation', ['atlas']],
      ['networks', ['network']],
    ],
    'a colouring the build does not publish is not offered',
  );
});

test('a colour or atlas option names what choosing it changes', () => {
  assert.equal(
    colourOption('en', 'cab-np', { atlas: 'destrieux', required: 'hcp-mmp' }),
    'CAB-NP networks (atlas becomes HCP-MMP)',
  );
  assert.equal(
    colourOption('en', 'cab-np', { atlas: 'hcp-mmp', required: 'hcp-mmp' }),
    'CAB-NP networks',
  );
  assert.equal(colourOption('en', 'tissue', { atlas: 'destrieux', required: null }), 'Tissue');
  assert.equal(atlasOption('en', 'destrieux', 'hcp-mmp'), 'Destrieux (colour becomes Regions)');
  assert.equal(atlasOption('en', 'hcp-mmp', 'hcp-mmp'), 'HCP-MMP');
  assert.equal(atlasOption('en', 'destrieux', undefined), 'Destrieux');
});

test('a download says how far it has come, or that it has started', () => {
  for (const lang of ['en', 'fr'] as const) {
    assert.equal(loadingText(lang), t(lang, 'header').loading);
    assert.equal(loadingText(lang, { loaded: 0, total: 0 }), t(lang, 'header').loading);
    assert.match(loadingText(lang, { loaded: 1, total: 4 }), /25/);
  }
});

test('MAST-28 a name loses its quotation marks and doubled spaces, and may end up empty', () => {
  assert.equal(subjectName({ id: 'x', display_name: 'MGH CDMD “sub_013”' }), 'MGH CDMD sub_013');
  assert.equal(subjectName({ id: 'x', display_name: ' A  "b" ' }), 'A b');
  assert.equal(subjectName({ display_name: '””' }), '');
  assert.equal(subjectName({ id: 'y', subject: 'sub' }), 'sub', 'the subject before the entry id');
});

test('MAST-29 Colour offers each published colouring under its name, in both languages', () => {
  const required = (mode: string) =>
    mode === 'cab-np' || mode === 'functional' ? 'hcp-mmp' : null;
  const names = (lang: 'en' | 'fr') =>
    (['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional'] as const).map((mode) =>
      colourOption(lang, mode, { atlas: 'destrieux', required: required(mode) }),
    );
  assert.deepEqual(names('en'), [
    'Tissue',
    'T1 MRI',
    'Regions',
    'Yeo 7 networks',
    'CAB-NP networks (atlas becomes HCP-MMP)',
    'Functional divisions (atlas becomes HCP-MMP)',
  ]);
  assert.deepEqual(names('fr'), [
    'Tissu',
    'IRM T1',
    'Régions',
    'Réseaux Yeo 7',
    'Réseaux CAB-NP (l’atlas devient HCP-MMP)',
    'Divisions fonctionnelles (l’atlas devient HCP-MMP)',
  ]);
  assert.deepEqual(colourGroups({}), [
    ['appearance', ['tissue', 'mri']],
    ['parcellation', ['atlas']],
  ]);
  assert.deepEqual(colourGroups({ cabNp: {}, functionalRegions: {} }).slice(2), [
    ['networks', ['cab-np']],
    [null, ['functional']],
  ]);
});

test('MAST-30 an atlas option names the colouring it falls back to, in both languages', () => {
  const options = (lang: 'en' | 'fr') =>
    ['destrieux', 'hcp-mmp', 'aseg'].map((id) => atlasOption(lang, id, 'hcp-mmp'));
  assert.deepEqual(options('en'), [
    'Destrieux (colour becomes Regions)',
    'HCP-MMP',
    'FreeSurfer aseg (colour becomes Regions)',
  ]);
  assert.deepEqual(options('fr'), [
    'Destrieux (la couleur devient Régions)',
    'HCP-MMP',
    'FreeSurfer aseg (la couleur devient Régions)',
  ]);
  assert.equal(
    colourOption('fr', 'cab-np', { atlas: 'hcp-mmp', required: 'hcp-mmp' }),
    'Réseaux CAB-NP',
  );
});

test('MAST-32 a download shows its percentage, or that it has started', () => {
  assert.equal(loadingText('en'), 'Loading…');
  assert.equal(loadingText('en', null), 'Loading…');
  assert.equal(loadingText('en', { loaded: 0, total: 0 }), 'Loading…');
  assert.equal(loadingText('en', { loaded: 1, total: 4 }), 'Loading 25%');
  assert.equal(loadingText('en', { loaded: 5, total: 5 }), 'Loading 100%');
  assert.equal(loadingText('fr'), 'Chargement…');
  assert.equal(loadingText('fr', { loaded: 1, total: 4 }), 'Chargement 25 %');
  assert.equal(loadingText('fr', { loaded: 5, total: 5 }), 'Chargement 100 %');
});

test('MAST-38 a summary with a tract reference shows only the reference, and drops empty parts', () => {
  assert.deepEqual(dataSummary({ subject: '', atlas: 'Destrieux', reference: '' }), [
    { part: 'atlas', text: 'Destrieux' },
  ]);
  assert.deepEqual(dataSummary({ subject: 'bert', atlas: null, colour: undefined }), [
    { part: 'subject', text: 'bert' },
  ]);
});

test('COLO-01 the statement is the same in every state, in each language', () => {
  const anatomy = { display_name: 'SNAIL “subj_1”', individual: true };
  for (const parts of [undefined, { anatomy }, { reference: { label: 'Ref' } }]) {
    assert.equal(colophonParts('en', parts).statement, 'Not clinical anatomy');
    assert.equal(colophonParts('fr', parts).statement, 'Pas une anatomie clinique');
  }
});

test('COLO-02 the description names the subject and what kind of anatomy it is', () => {
  const named = (individual: boolean) => ({
    anatomy: { display_name: 'SNAIL “subj_1”', individual },
  });
  assert.equal(
    colophonParts('en', named(true)).description,
    'SNAIL subj_1 · one individual’s MRI reconstruction',
  );
  assert.equal(
    colophonParts('fr', named(true)).description,
    'SNAIL subj_1 · reconstruction IRM d’un individu',
  );
  assert.equal(
    colophonParts('en', named(false)).description,
    'SNAIL subj_1 · averaged reference template',
  );
  assert.equal(
    colophonParts('fr', named(false)).description,
    'SNAIL subj_1 · gabarit de référence moyenné',
  );
  const reference = { reference: { label: 'Ref' } };
  assert.equal(colophonParts('en', reference).description, 'Ref · reference data');
  assert.equal(colophonParts('fr', reference).description, 'Ref · données de référence');
  assert.equal(colophonParts('en').description, '');
});
