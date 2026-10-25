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
