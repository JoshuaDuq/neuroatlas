import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { declarationsBySelector } from '../src/styles/css-scan.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

// Prettier normalises string quotes; values are compared with one quote style.
const normalise = (rules: Record<string, Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(rules).map(([selector, properties]) => [
      selector.replace(/"/g, "'"),
      Object.fromEntries(
        Object.entries(properties).map(([name, value]) => [name, value.replace(/"/g, "'")]),
      ),
    ]),
  );

describe('U1 styles parity', () => {
  it('tokens.css declares exactly the legacy tokens, in both themes', () => {
    const legacy = normalise(declarationsBySelector(read('../../viewer/styles/tokens.css')));
    const current = normalise(declarationsBySelector(read('../src/styles/tokens.css')));
    assert.deepEqual(Object.keys(current), [':root', ":root[data-theme='dark']"]);
    // The one documented difference: deviations/u1-overlay-control-contrast.md (WCAG 1.4.11).
    assert.equal(legacy[':root']['--overlay-control-border'], '#6d737b');
    assert.equal(current[':root']['--overlay-control-border'], '#70777f');
    legacy[':root']['--overlay-control-border'] = '#70777f';
    assert.deepEqual(current, legacy);
  });

  it('the increased-contrast token swap matches a11y.css 19-33 of the legacy sheet', () => {
    const legacy = declarationsBySelector(
      read('../../viewer/styles/a11y.css').split('\n').slice(18, 33).join('\n') + '\n}',
    );
    const current = declarationsBySelector(read('../src/styles/a11y.css'));
    assert.deepEqual(
      normalise({ r: current[":root, :root[data-theme='dark']"] }),
      normalise({ r: legacy[':root, :root[data-theme="dark"]'] }),
    );
  });

  it('base.css keeps the legacy focus ring, hidden rule and visually-hidden clip', () => {
    const legacy = declarationsBySelector(read('../../viewer/styles/base.css'));
    const current = declarationsBySelector(read('../src/styles/base.css'));
    for (const selector of [
      ':focus-visible',
      ':focus:not(:focus-visible)',
      '[hidden]',
      '.visually-hidden',
      'body',
    ]) {
      assert.deepEqual(current[selector], legacy[selector], selector);
    }
  });

  it('elements.css keeps the legacy key caps and the utility classes', () => {
    const legacyBase = declarationsBySelector(read('../../viewer/styles/base.css'));
    const legacyComponents = declarationsBySelector(read('../../viewer/styles/components.css'));
    const current = declarationsBySelector(read('../src/styles/elements.css'));
    for (const selector of ['.measure', '.code']) {
      assert.deepEqual(current[selector], legacyBase[selector], selector);
    }
    for (const selector of ['kbd', '.key-range']) {
      assert.ok(legacyComponents[selector], selector);
      assert.deepEqual(current[selector], legacyComponents[selector], selector);
    }
  });
});
