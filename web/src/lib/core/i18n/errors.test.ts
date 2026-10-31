import assert from 'node:assert/strict';
import { test } from 'vitest';
import { failureNotice, linkNotice, startFailure } from './errors.ts';
import { t } from './index.ts';

const assetError = (code: string, message: string) => Object.assign(new Error(message), { code });

test('a newer deploy asks for a reload, in either language', () => {
  for (const lang of ['en', 'fr']) {
    const notice = failureNotice(
      assetError('asset-updated', 'Published file changed'),
      lang,
      'layer',
      'HCP-MMP',
    );
    assert.deepEqual(notice, { text: t(lang, 'errors').updated, action: 'reload' });
  }
});

test('a failed layer switch is said in French when the reader reads French', () => {
  assert.match(
    failureNotice(new Error('boom'), 'fr', 'layer', 'Destrieux').text,
    /^Impossible de charger Destrieux\./,
  );
});

test('a failed download says what could not be done and what to check, never the HTTP detail', () => {
  const { text, action } = failureNotice(
    assetError('asset-fetch', 'Asset request failed: HTTP 503'),
    'en',
    'layer',
    'HCP-MMP',
  );
  assert.equal(
    text,
    'Could not load HCP-MMP. A file could not be downloaded. Check the connection and try again.',
  );
  assert.equal(action, null);
});

test('any other failure names the operation, not the parser that gave up', () => {
  // A missing file once made GLTFLoader parse the 404 page and report "Unexpected token '<'".
  const error = new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`);
  for (const lang of ['en', 'fr']) {
    const { text } = failureNotice(error, lang, 'snapshot');
    assert.equal(text, t(lang, 'errors').operations.snapshot);
    assert.doesNotMatch(text, /Unexpected|doctype/);
  }
  assert.throws(() => failureNotice(error, 'en', 'unheard-of'), /No failure text/);
});

test('an operation that names its subject refuses to be worded without one', () => {
  assert.throws(() => failureNotice(new Error('x'), 'en', 'layer'), /needs a subject/);
});

test('every operation has words in both languages', () => {
  const english = Object.keys(t('en', 'errors').operations);
  assert.deepEqual(Object.keys(t('fr', 'errors').operations), english);
  for (const operation of english) {
    for (const lang of ['en', 'fr']) {
      assert.ok(failureNotice(new Error('x'), lang, operation, 'T1').text);
    }
  }
});

test('the fields a link could not apply are named in the reader’s words, once each', () => {
  assert.equal(
    linkNotice(['pos', 'lang', 'pos'], 'en').text,
    'Not applied from this link: section position and language.',
  );
  assert.equal(
    linkNotice(['pos', 'lang'], 'fr').text,
    'Éléments du lien non appliqués : position de la coupe et langue.',
  );
  assert.deepEqual(Object.keys(t('fr', 'link').fields), Object.keys(t('en', 'link').fields));
});

test('a link whose circuit is unknown names the circuit, not its step as well', () => {
  assert.equal(linkNotice(['circuit', 'step'], 'en').text, 'Not applied from this link: circuit.');
  assert.equal(
    linkNotice(['step', 'circuit'], 'fr').text,
    'Éléments du lien non appliqués : circuit.',
  );
  assert.equal(linkNotice(['step'], 'en').text, 'Not applied from this link: circuit step.');
});

test('a failed start keeps the link for a download failure and drops it otherwise', () => {
  const offline = startFailure(assetError('asset-fetch', 'HTTP 503'), 'en', true);
  assert.equal(offline.dropLink, false);
  assert.equal(offline.button, 'Retry');
  assert.match(offline.text, /^Could not load the anatomy\. A file could not be downloaded/);
  const updated = startFailure(assetError('asset-updated', 'changed'), 'fr', true);
  assert.deepEqual(updated, {
    text: t('fr', 'errors').updated,
    button: 'Recharger',
    dropLink: false,
  });
  const fromLink = startFailure(new Error('Unknown view: Left'), 'en', true);
  assert.equal(fromLink.dropLink, true);
  assert.equal(fromLink.text, 'Could not open this link. Retry opens Planum without this link.');
  assert.equal(startFailure(new Error('boom'), 'en', false).dropLink, false);
});

test('I18N-16 · a newer deploy is worded as an update whatever the operation', () => {
  const updated = assetError('asset-updated', 'changed');
  assert.deepEqual(failureNotice(updated, 'en', 'snapshot'), {
    text: 'Planum was updated. Reload to continue.',
    action: 'reload',
  });
  assert.equal(
    failureNotice(updated, 'fr', 'snapshot').text,
    'Planum a été mis à jour. Rechargez la page pour continuer.',
  );
  assert.equal(
    failureNotice(new Error('boom'), 'xx', 'snapshot').text,
    'Could not save the image.',
  );
});

test('I18N-17 · asking for words an operation does not have throws', () => {
  const error = new Error('x');
  assert.throws(() => failureNotice(error, 'en', 'unheard-of'), /No failure text for unheard-of/);
  assert.throws(() => failureNotice(error, 'en', 'layer'), /layer failure text needs a subject/);
  assert.throws(() => failureNotice(error, 'en', 'colour'), /colour failure text needs a subject/);
});

test('I18N-18 · the 18 operations are listed in order, with subject sentences in both languages', () => {
  const order = [
    'start',
    'link',
    'layer',
    'colour',
    'region',
    'cord',
    'system',
    'internal',
    'whiteMatter',
    'wholeBrain',
    'snapshot',
    'section',
    'deficit',
    'landmark',
    'mri',
    'comparison',
    'overlap',
    'restore',
  ];
  // fullscreen is G6's addition (decision 33), after the legacy 18; a landmark's streamlines follow.
  for (const lang of ['en', 'fr'] as const) {
    assert.deepEqual(Object.keys(t(lang, 'errors').operations), [
      ...order,
      'fullscreen',
      'streamlines',
    ]);
  }
  assert.equal(
    t('en', 'errors').operations.colour('CAB-NP'),
    'Could not show the CAB-NP colouring.',
  );
  assert.equal(
    t('fr', 'errors').operations.colour('CAB-NP'),
    'Impossible d’afficher la coloration « CAB-NP ».',
  );
});

test('I18N-19 · a failed start is worded with its button and whether Retry drops the link', () => {
  assert.deepEqual(startFailure(assetError('asset-fetch', 'HTTP 503'), 'en', true), {
    text: 'Could not load the anatomy. A file could not be downloaded. Check the connection and try again.',
    button: 'Retry',
    dropLink: false,
  });
  assert.deepEqual(startFailure(assetError('asset-updated', 'changed'), 'fr', true), {
    text: 'Planum a été mis à jour. Rechargez la page pour continuer.',
    button: 'Recharger',
    dropLink: false,
  });
  assert.deepEqual(startFailure(new Error('boom'), 'en', false), {
    text: 'Could not load the anatomy.',
    button: 'Retry',
    dropLink: false,
  });
});

test('I18N-20 · the link notice names an unknown field as is and has no action', () => {
  assert.deepEqual(linkNotice(['unknown-field'], 'en'), {
    text: 'Not applied from this link: unknown-field.',
    action: null,
  });
  assert.equal(linkNotice(['pos', 'lang'], 'fr').action, null);
});
