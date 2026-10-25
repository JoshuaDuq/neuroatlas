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
