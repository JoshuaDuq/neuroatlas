import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inspectorEmptyChrome } from './inspector.js';
import { relatedRegionVisible } from './clinical.js';
import { anatomySwitchLabel } from './header.js';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function tagWithId(id) {
  const match = html.match(new RegExp(`<[^>]*\\sid="${id}"[^>]*>`));
  assert.ok(match, `expected an element with id="${id}"`);
  return match[0];
}

test('spinal cord starts off in markup, matching the model default', () => {
  const input = tagWithId('spinal-cord');
  assert.equal(/\schecked\b/.test(input), false);
});

test('chrome has no share control; the address bar is the permalink', () => {
  assert.equal(/id="share"/.test(html), false);
  assert.equal(/>Share</.test(html), false);
});

test('empty inspector has no duplicate view-status datasheet', () => {
  assert.equal(/id="view-status"/.test(html), false);
});

test('anatomy/deficits is a panel switch, not a masthead instrument', () => {
  const tag = tagWithId('explorer-switch');
  assert.match(tag, /\brail-tabs\b/);
  assert.equal(/\binstrument\b/.test(tag), false);
});

test('cut plane lives in the cuts panel, not across every inspector tab', () => {
  const cuts = html.indexOf('data-tab="cuts"');
  const plane = html.indexOf('id="cut-mode"');
  const display = html.indexOf('data-tab="display"');
  assert.ok(cuts !== -1 && plane !== -1 && display !== -1);
  assert.ok(plane > cuts, 'cut-mode must sit inside the cuts tab group');
  assert.ok(plane < display, 'cut-mode must not follow the display panel');
  assert.equal(/\binstrument\b/.test(tagWithId('cut-mode')), false);
});

test('atlas and surface colour remain the masthead instruments', () => {
  assert.match(tagWithId('atlas-switch'), /\binstrument\b/);
  assert.match(tagWithId('surface-switch'), /\binstrument\b/);
});

test('hemisphere is a display setting, not a masthead instrument', () => {
  const tag = tagWithId('hemisphere');
  assert.match(tag, /\bsegmented\b/);
  assert.equal(/\binstrument\b/.test(tag), false);
});

test('Slice here opens the cuts panel so the plane the reader just invoked is on screen', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const slice = app.match(/const onSliceTo = async \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(slice, 'expected onSliceTo in app.js');
  assert.match(slice[1], /inspectorTabs\.show\(\s*'cuts'\s*\)/);
  assert.match(slice[1], /sheet\.show\(\s*'cuts'\s*\)/);
});

test('empty inspector is a hint; the title and facts stay reserved for a region', () => {
  const empty = inspectorEmptyChrome({ selectedRegion: null, explorer: 'anatomy' });
  assert.deepEqual(empty, {
    hideTitle: true,
    hideHint: false,
    hideFacts: true,
    hideActions: true,
  });
});

test('a deficit with no region hides the anatomy hint as well', () => {
  const empty = inspectorEmptyChrome({ selectedRegion: null, explorer: 'deficits' });
  assert.equal(empty.hideHint, true);
  assert.equal(empty.hideTitle, true);
  assert.equal(empty.hideActions, true);
});

test('neuropsychology is omitted when the region has no associations', () => {
  assert.equal(relatedRegionVisible(null, 0), false);
  assert.equal(relatedRegionVisible({ id: 'destrieux:left:1' }, 0), false);
  assert.equal(relatedRegionVisible({ id: 'destrieux:left:1' }, 2), true);
});

test('the anatomy switch lives in the identity cluster, not among settings', () => {
  const identity = html.indexOf('class="identity"');
  const atlas = html.indexOf('id="atlas-switch"');
  const anatomy = html.indexOf('id="anatomy-switch"');
  const menu = html.indexOf('id="masthead-menu"');
  assert.ok(identity !== -1 && atlas !== -1 && anatomy !== -1 && menu !== -1);
  assert.ok(anatomy > identity && anatomy < atlas, 'anatomy-switch belongs with the wordmark');
  assert.ok(anatomy < menu, 'anatomy-switch must not sit in the settings menu');
});

test('anatomy switch labels are the specimen, not the full reconstruction title', () => {
  assert.equal(anatomySwitchLabel({ id: 'bert', display_name: 'FreeSurfer “bert”' }), 'bert');
  assert.equal(anatomySwitchLabel({ id: 'aomic', display_name: 'AOMIC-PIOP1 “sub-0022”' }), 'sub-0022');
  assert.equal(anatomySwitchLabel({ id: 'x' }), 'x');
});

test('snapshot and fullscreen sit in the masthead, not on the anatomy', () => {
  const menu = html.indexOf('id="masthead-menu"');
  const viewport = html.indexOf('<main id="viewport"');
  const fs = html.indexOf('id="viewport-fullscreen"');
  const snap = html.indexOf('id="viewport-snapshot"');
  assert.ok(menu !== -1 && viewport !== -1 && fs !== -1 && snap !== -1);
  assert.ok(fs > menu && fs < viewport);
  assert.ok(snap > menu && snap < viewport);
});

test('linked MRI is the filled member of the actions row, not a second banner', () => {
  const regionActions = html.match(/<div class="actions">\s*<button id="focus"[\s\S]*?<\/div>/);
  assert.ok(regionActions, 'expected the region actions row');
  assert.match(regionActions[0], /id="region-mpr"/);
  const cutsActions = html.match(/<div class="actions">\s*<button id="cut-midline"[\s\S]*?<\/div>/);
  assert.ok(cutsActions, 'expected the cuts actions row');
  assert.match(cutsActions[0], /id="mpr-open"/);
});

test('a selected region shows the title, facts and actions', () => {
  const selected = inspectorEmptyChrome({
    selectedRegion: { id: 'destrieux:left:1' },
    explorer: 'anatomy',
  });
  assert.deepEqual(selected, {
    hideTitle: false,
    hideHint: false,
    hideFacts: false,
    hideActions: false,
  });
});
