import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import type { ClinicalData } from '../clinical/types.ts';
import { TRANSLATIONS } from '../i18n/index.ts';
import {
  publishedCorrections,
  relatedRegionVisible,
  revealNotice,
  sharedSide,
  sideStated,
  stageMessage,
  type RevealSettings,
} from './clinical.ts';

const CLINICAL_TEXT = { en: TRANSLATIONS.en.clinical, fr: TRANSLATIONS.fr.clinical };
const idle = {
  opening: false,
  busy: 'loading',
  error: null,
  failure: null,
  operation: 'deficit',
  lang: 'en',
  status: 'shown',
} as const;

test('an opened deficit says what the stage shows', () => {
  for (const lang of ['en', 'fr'] as const) {
    assert.equal(stageMessage(CLINICAL_TEXT[lang], { ...idle, lang }), 'shown');
  }
});

test('work in progress names itself: opening anatomy, or restoring the view', () => {
  const text = CLINICAL_TEXT.en;
  assert.equal(stageMessage(text, { ...idle, opening: true }), text.loading);
  assert.equal(stageMessage(text, { ...idle, opening: true, busy: 'restoring' }), text.restoring);
});

test('failures are said in the reader’s language, never as the developer’s message', () => {
  const error = new Error('Unknown clinical region: x');
  assert.equal(
    stageMessage(CLINICAL_TEXT.fr, { ...idle, lang: 'fr', error, failure: 'restoreFailed' }),
    CLINICAL_TEXT.fr.restoreFailed,
  );
  assert.equal(
    stageMessage(CLINICAL_TEXT.en, { ...idle, error, operation: 'deficit' }),
    'Could not show this deficit’s regions.',
  );
  const offline = Object.assign(new Error('Asset request failed: HTTP 503'), {
    code: 'asset-fetch',
  });
  const said = stageMessage(CLINICAL_TEXT.fr, {
    ...idle,
    lang: 'fr',
    error: offline,
    operation: 'region',
  });
  assert.match(said, /^Impossible d’afficher la région\. Un fichier n’a pas pu être téléchargé/);
  assert.doesNotMatch(said, /HTTP/);
});

const settings: RevealSettings = {
  atlas: 'destrieux',
  cutAtlas: 'destrieux',
  colour: 'atlas',
  detail: 'learning',
  cut: false,
  isolated: false,
  hemisphere: 'both',
  cortex: true,
};

test('opening a deficit claims no change when nothing in the reader’s settings changed', () => {
  for (const lang of ['en', 'fr'] as const) {
    assert.equal(revealNotice(lang, settings, { ...settings }), null);
  }
});

test('what opening a deficit changed is said once, as one sentence naming only what happened', () => {
  const after = { ...settings, detail: 'aseg' };
  assert.equal(revealNotice('en', settings, after), 'Internal anatomy set to FreeSurfer aseg.');
  assert.equal(revealNotice('fr', settings, after), 'Anatomie interne réglée sur FreeSurfer aseg.');
  const cut = { ...settings, cut: true, isolated: true };
  assert.equal(
    revealNotice('en', cut, after),
    'Section closed, isolation cleared, and internal anatomy set to FreeSurfer aseg.',
  );
  assert.equal(
    revealNotice('fr', cut, after),
    'Coupe fermée, isolement retiré et anatomie interne réglée sur FreeSurfer aseg.',
  );
});

test('cut labels the reveal moved onto the painted atlas are named', () => {
  const after = { ...settings, cutAtlas: 'hcp-mmp' };
  assert.equal(revealNotice('en', settings, after), 'Cut labels set to HCP-MMP.');
  assert.equal(revealNotice('fr', settings, after), 'Étiquettes de coupe réglées sur HCP-MMP.');
});

test('an atlas, colouring, side or cortex the reveal changed is named; a cut or isolation is only ever cleared', () => {
  const before = { ...settings, atlas: 'hcp-mmp', colour: 'cab-np', hemisphere: 'left' } as const;
  assert.equal(
    revealNotice('en', before, { ...settings, cortex: false }),
    'Atlas set to Destrieux, colour set to Regions, both hemispheres shown, and cortex hidden.',
  );
  // A cut or isolation the reader makes after opening is not something the reveal cleared.
  assert.equal(revealNotice('en', settings, { ...settings, cut: true, isolated: true }), null);
});

test('region links drop the side their association already states, and keep it when sides differ', () => {
  assert.equal(sideStated('left', ['left', 'left']), true);
  assert.equal(sideStated('right', ['right']), true);
  assert.equal(sideStated('bilateral', ['left', 'right']), false);
  assert.equal(sideStated('left', ['left', 'right']), false);
  assert.equal(sideStated('left', ['midline']), false);
  assert.equal(sideStated('left', []), false);
});

test('a profile whose findings all share one side states it once; mixed sides stay on each finding', () => {
  assert.equal(sharedSide(['left', 'left', 'left', 'left', 'left', 'left']), 'left');
  assert.equal(sharedSide(['right']), 'right');
  assert.equal(sharedSide(['bilateral', 'bilateral']), 'bilateral');
  assert.equal(sharedSide(['left', 'right']), null);
  assert.equal(sharedSide(['left', 'bilateral', 'left']), null);
  assert.equal(sharedSide([]), null);
});

test('a reference’s published corrections are listed in the reader’s language with their DOI', () => {
  const data = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
  const corrected = data.references.filter((reference) => reference.corrections);
  assert.ok(corrected.length > 0);
  for (const reference of corrected) {
    for (const lang of ['en', 'fr'] as const) {
      const listed = publishedCorrections(reference, lang);
      assert.equal(listed.length, reference.corrections!.length);
      for (const [index, entry] of listed.entries()) {
        assert.equal(entry.href, `https://doi.org/${reference.corrections![index].doi}`);
        assert.equal(entry.summary, reference.corrections![index].summary[lang]);
      }
    }
  }
  assert.deepEqual(publishedCorrections({}, 'en'), []);
  for (const lang of ['en', 'fr'] as const) assert.ok(CLINICAL_TEXT[lang].correction);
});

test('neuropsychology is omitted when the region has no associations', () => {
  assert.equal(relatedRegionVisible(null, 0), false);
  assert.equal(relatedRegionVisible({ id: 'destrieux:left:1' }, 0), false);
  assert.equal(relatedRegionVisible({ id: 'destrieux:left:1' }, 2), true);
});
