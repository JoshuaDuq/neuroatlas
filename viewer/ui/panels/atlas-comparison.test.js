import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAtlasComparison } from './atlas-comparison.js';

const directory = new URL('../../../public/models/cdmd/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
const bytes = readFileSync(new URL(manifest.atlas_comparison.file, directory));

async function comparisonFixture(t, highlight = async () => true) {
  const previous = globalThis.document;
  const nodes = new Map();
  let loaded;
  const ready = new Promise(resolve => { loaded = resolve; });
  function element(id) {
    const node = new EventTarget();
    const attributes = new Map();
    Object.assign(node, {
      children: [], dataset: {}, hidden: false, open: false,
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name); },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) {
        this.children = children;
        if (id === 'comparison-sources') loaded();
      },
      contains: () => false,
    });
    return node;
  }
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  globalThis.document = { activeElement: null, getElementById: byId, createElement: element };
  byId('comparison-columns').append(element('span'), element('span'), element('span'));
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(bytes));
  const clearHighlight = t.mock.fn();
  const comparison = createAtlasComparison({
    manifest, manifestUrl: 'https://example.invalid/models/cdmd/manifest.json',
    highlight, clearHighlight,
  });
  t.after(() => {
    comparison.dispose();
    globalThis.document = previous;
  });
  const state = {
    selectedRegion: manifest.regions.find(region => region.kind === 'cortex'),
    lang: 'en', outlineAvailable: true,
  };
  comparison.update(state);
  await ready;
  const panel = byId('region-comparison');
  const toggle = open => {
    panel.open = open;
    panel.dispatchEvent(new Event('toggle'));
  };
  return {
    comparison, byId, panel, toggle, state, fetch, clearHighlight,
    row: () => byId('comparison-list').children[0].children[0],
  };
}

test('closing the comparison clears an active overlap and its pressed state', async t => {
  const fixture = await comparisonFixture(t);
  const { panel, toggle, row, fetch, clearHighlight } = fixture;
  assert.equal(panel.open, false);
  assert.equal(fetch.mock.callCount(), 1, 'comparison data still loads while closed');
  const initialClears = clearHighlight.mock.callCount();
  toggle(true);
  assert.equal(clearHighlight.mock.callCount(), initialClears, 'opening preserves the selection');
  row().dispatchEvent(new Event('click'));
  await Promise.resolve();
  assert.equal(row().getAttribute('aria-pressed'), 'true');

  const clears = clearHighlight.mock.callCount();
  toggle(false);
  assert.equal(clearHighlight.mock.callCount(), clears + 1);
  assert.equal(row().getAttribute('aria-pressed'), 'false');
  assert.equal(panel.getAttribute('aria-busy'), 'false');
});

test('closing the comparison cancels a pending overlap before it can become active', async t => {
  let finish;
  const { panel, toggle, row, clearHighlight } = await comparisonFixture(t,
    () => new Promise(resolve => { finish = resolve; }));
  toggle(true);
  row().dispatchEvent(new Event('click'));
  assert.equal(panel.getAttribute('aria-busy'), 'true');

  const clears = clearHighlight.mock.callCount();
  toggle(false);
  assert.equal(clearHighlight.mock.callCount(), clears + 1);
  assert.equal(panel.getAttribute('aria-busy'), 'false');
  finish(true);
  await Promise.resolve();
  toggle(true);
  assert.equal(row().getAttribute('aria-pressed'), 'false');
});

test('disposing the comparison unregisters its disclosure listener', async t => {
  const { comparison, toggle, clearHighlight } = await comparisonFixture(t);
  toggle(true);
  comparison.dispose();
  const clears = clearHighlight.mock.callCount();
  toggle(false);
  assert.equal(clearHighlight.mock.callCount(), clears);
});
