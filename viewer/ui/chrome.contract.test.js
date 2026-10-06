import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inspectorEmptyChrome } from './inspector.js';
import { relatedRegionVisible } from './clinical.js';
import { colophonParts, dataSummary, subjectName } from './header.js';
import { t } from '../i18n/translations.js';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function tagWithId(id) {
  const match = html.match(new RegExp(`<[^>]*\\sid="${id}"[^>]*>`));
  assert.ok(match, `expected an element with id="${id}"`);
  return match[0];
}

test('internal anatomy starts off checked, matching the model default', () => {
  const input = tagWithId('internal-visible');
  assert.match(input, /\schecked\b/);
});

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

test('the content modes are the panel\'s one tab row, with no segmented row under it', () => {
  assert.match(tagWithId('workspace-tabs'), /role="tablist"/);
  assert.match(tagWithId('sheet-tabs'), /role="tablist"/);
  assert.equal(/id="explorer-switch"|data-explorer=/.test(html), false);
  assert.equal(/data-tab="(find|cuts|display)"/.test(html), false);
});

test('the detail view opens with its way back, inside the panel it returns from', () => {
  const inspector = html.indexOf('<aside id="inspector"');
  const back = html.indexOf('id="detail-back"');
  assert.ok(inspector !== -1 && back > inspector);
  assert.ok(back < html.indexOf('class="rail-body"', inspector));
});

test('the location bar is one breadcrumb: the way back, then the group, which is the current place', () => {
  assert.match(tagWithId('detail-path'), /^<nav\b[^>]*aria-label="[^"]+"/);
  const path = html.slice(html.indexOf('id="detail-path"'), html.indexOf('</nav>', html.indexOf('id="detail-path"')));
  assert.ok(path.indexOf('id="detail-back"') < path.indexOf('id="detail-group"'));
  assert.match(tagWithId('detail-group'), /aria-current="location"/);
  assert.equal(/aria-current/.test(tagWithId('detail-back')), false);
  assert.ok(html.indexOf('id="circuit-stepper"') > html.indexOf('</nav>', html.indexOf('id="detail-path"')),
    'the lesson stepper shares the bar, outside the path');
});

test('the panel precedes the stage in reading and Tab order', () => {
  const sheet = html.indexOf('<div id="sheet"');
  assert.ok(sheet !== -1 && sheet > html.indexOf('<header id="masthead"'));
  assert.ok(sheet < html.indexOf('<main id="viewport"'));
});

test('the phone grip keeps the statement beside the handle, not in a row of its own', () => {
  const row = html.match(/<div class="sheet-grip-row">[\s\S]*?<\/div>/);
  assert.ok(row, 'expected the grip row');
  assert.match(row[0], /id="sheet-handle"/);
  assert.match(row[0], /id="sheet-disclaimer"/);
});

function stageHtml() {
  const start = html.indexOf('<main id="viewport"');
  assert.ok(start !== -1, 'expected the stage');
  return html.slice(start, html.indexOf('</main>', start));
}

function inspectorHtml() {
  const start = html.indexOf('<aside id="inspector"');
  assert.ok(start !== -1, 'expected the inspector');
  return html.slice(start, html.indexOf('</aside>', start));
}

const STAGE_CONTROLS = ['cut-mode', 'cut-atlas', 'cut-position', 'cut-number', 'cut-tilt', 'cut-azimuth',
  'cut-reverse', 'cut-status', 'mpr-open', 'hemisphere', 'cortex', 'opacity', 'internal-visible',
  'spinal-cord', 'reset'];

test('cut and display controls live on the stage, not in the panel', () => {
  const stage = stageHtml();
  const inspector = inspectorHtml();
  for (const id of STAGE_CONTROLS) {
    assert.ok(stage.includes(`id="${id}"`), `${id} belongs on the stage`);
    assert.equal(inspector.includes(`id="${id}"`), false, `${id} must not stay in the panel`);
  }
  assert.equal(/\binstrument\b/.test(tagWithId('cut-mode')), false);
});

test('the Section and Display tools open their popovers and say so', () => {
  for (const [tool, popover] of [['section-tool', 'section-popover'], ['display-tool', 'display-popover']]) {
    const button = tagWithId(tool);
    assert.match(button, /aria-haspopup="dialog"/);
    assert.match(button, /aria-expanded="false"/);
    assert.match(button, new RegExp(`aria-controls="${popover}"`));
    const panel = tagWithId(popover);
    assert.match(panel, /role="dialog"/);
    assert.match(panel, /\shidden\b/);
  }
});

test('the presets, then the tools, share one plate; the section bar waits for a plane', () => {
  const stage = stageHtml();
  const views = stage.indexOf('id="views"');
  assert.ok(views < stage.indexOf('id="section-tool"'));
  assert.ok(stage.indexOf('id="section-tool"') < stage.indexOf('id="display-tool"'));
  assert.match(tagWithId('views'), /role="toolbar"/);
  assert.match(tagWithId('section-bar'), /\shidden\b/);
});

test('the view presets are a segmented choice, like the cutting planes above them', () => {
  assert.match(tagWithId('views'), /\bsegmented\b/);
  assert.match(tagWithId('cut-mode'), /\bsegmented\b/);
  const chooser = tagWithId('view-tool');
  assert.match(chooser, /aria-haspopup="dialog"/);
  assert.match(chooser, /aria-controls="view-popover"/);
});

test('the stage offers linked MRI once, on the section bar while a plane is cut', () => {
  const popover = html.slice(html.indexOf('id="section-popover"'), html.indexOf('id="display-tool"'));
  assert.equal(/Linked MRI|mpr/i.test(popover), false);
  const bar = html.slice(html.indexOf('id="section-bar"'), html.indexOf('id="cut-status"'));
  assert.match(bar, /id="mpr-open" class="stage-command"/);
});

test('nothing on the stage is a filled button', () => {
  assert.equal(/button-primary/.test(stageHtml()), false);
});

function mastheadHtml() {
  const start = html.indexOf('<header id="masthead"');
  assert.ok(start !== -1, 'expected the masthead');
  return html.slice(start, html.indexOf('</header>', start));
}

test('subject, atlas, colour and internal detail live in the masthead data group', () => {
  assert.match(tagWithId('atlas-switch'), /\binstrument\b/);
  assert.match(tagWithId('surface-switch'), /\binstrument\b/);
  const masthead = mastheadHtml();
  const data = masthead.slice(masthead.indexOf('id="masthead-data"'));
  for (const id of ['anatomy-switch', 'study-name', 'atlas-switch', 'surface-switch', 'detail']) {
    assert.ok(data.includes(`id="${id}"`), `${id} belongs in the masthead data group`);
  }
});

test('the collapsed summary opens the one data group rather than a copy of it', () => {
  const toggle = tagWithId('masthead-data-toggle');
  assert.match(toggle, /aria-controls="masthead-data"/);
  assert.match(toggle, /aria-expanded="false"/);
  for (const id of ['anatomy-switch', 'atlas-switch', 'surface-switch', 'detail']) {
    assert.equal(html.split(`id="${id}"`).length, 2, `${id} appears once`);
  }
});

test('hemisphere is a display setting, not a masthead instrument', () => {
  const tag = tagWithId('hemisphere');
  assert.match(tag, /\bsegmented\b/);
  assert.equal(/\binstrument\b/.test(tag), false);
  assert.equal(mastheadHtml().includes('id="hemisphere"'), false);
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

test('the circuit introduction replaces the empty anatomical hint', () => {
  assert.equal(inspectorEmptyChrome({ selectedRegion: null, explorer: 'circuits' }).hideHint, true);
  assert.ok(html.indexOf('id="circuit-profile"') < html.indexOf('id="label-selected"'));
});

test('an opened deficit leads its detail view, ahead of any selected region', () => {
  assert.ok(html.indexOf('id="clinical-profile"') < html.indexOf('id="label-selected"'));
});

test('the tracts MRI dock carries its one action, not a source filename', async () => {
  const source = await readFile(new URL('../diffusion/native-ui.js', import.meta.url), 'utf8');
  const dock = source.match(/<div class="native-tract-command">([\s\S]*?)<\/div>/);
  assert.ok(dock, 'expected the tracts MRI dock');
  assert.doesNotMatch(dock[1], /\.nii/);
  assert.match(dock[1], /id="native-tract-mri" class="button-primary"/);
});

test('neuropsychology is omitted when the region has no associations', () => {
  assert.equal(relatedRegionVisible(null, 0), false);
  assert.equal(relatedRegionVisible({ id: 'destrieux:left:1' }, 0), false);
  assert.equal(relatedRegionVisible({ id: 'destrieux:left:1' }, 2), true);
});

test('subject names keep the dataset with the subject, without quotation marks', () => {
  assert.equal(subjectName({ id: 'snail', display_name: 'SNAIL “subj_1”' }), 'SNAIL subj_1');
  assert.equal(subjectName({ id: 'aomic', display_name: 'AOMIC-PIOP1 “sub-0022”' }), 'AOMIC-PIOP1 sub-0022');
  assert.equal(subjectName({ id: 'x', subject: 'x' }), 'x');
  assert.equal(subjectName({ id: 'y' }), 'y');
});

test('the data summary names subject, atlas, colour and internal anatomy, or the tract reference alone', () => {
  const texts = parts => parts.map(({ text }) => text);
  const full = dataSummary({ subject: 'SNAIL subj_1', atlas: 'Destrieux', colour: 'Regions', detail: 'Teaching set' });
  assert.deepEqual(texts(full), ['SNAIL subj_1', 'Destrieux', 'Regions', 'Teaching set']);
  assert.deepEqual(full.map(({ part }) => part), ['subject', 'atlas', 'colour', 'detail']);
  assert.deepEqual(dataSummary({ subject: 'bert', atlas: 'Destrieux', colour: 'Regions', reference: 'SNAIL' }),
    [{ part: 'subject', text: 'SNAIL' }]);
  assert.deepEqual(texts(dataSummary({ subject: 'bert', atlas: 'Destrieux', detail: null })), ['bert', 'Destrieux']);
});

test('every masthead data choice is explained in a line, in both languages', () => {
  for (const lang of ['en', 'fr']) {
    const notes = t(lang, 'header').notes;
    for (const id of ['destrieux', 'hcp-mmp', 'learning', 'aseg', 'nextbrain']) {
      assert.ok(notes[id]?.length > 10, `${lang} ${id} has a note`);
    }
    for (const mode of ['tissue', 'mri', 'atlas', 'network']) assert.ok(t(lang, 'display').surfaceColorTitles[mode]);
  }
  for (const id of ['subject-note', 'atlas-note', 'surface-note', 'detail-note']) {
    assert.ok(mastheadHtml().slice(mastheadHtml().indexOf('id="masthead-data"')).includes(`id="${id}"`));
  }
});

test('the masthead says Subject, never Specimen, for an in-vivo MRI', () => {
  assert.equal(t('en', 'header').subject, 'Subject');
  assert.equal(t('fr', 'header').subject, 'Sujet');
  assert.equal(/Specimen|Spécimen/.test(mastheadHtml()), false);
});

test('the status bar keeps the not-clinical statement in every state', () => {
  const anatomy = { display_name: 'SNAIL “subj_1”', individual: true };
  for (const lang of ['en', 'fr']) {
    const loading = colophonParts(lang);
    assert.equal(loading.description, '', 'no dataset is named before one is loaded');
    assert.match(loading.statement, /clinical anatomy|anatomie clinique/i);
    assert.match(colophonParts(lang, { anatomy }).description, /SNAIL/);
    assert.match(colophonParts(lang, { anatomy }).statement, /clinical anatomy|anatomie clinique/);
    assert.match(colophonParts(lang, { anatomy, reference: { label: 'Ref' } }).statement, /clinical anatomy|anatomie clinique/);
  }
  assert.ok(html.indexOf('id="colophon-statement"') < html.indexOf('id="colophon-description"'),
    'the statement leads the status bar, ahead of the description that truncates');
  assert.equal(/FreeSurfer reference anatomy/.test(html), false);
});

test('the region count says the regions are the visible ones', () => {
  assert.equal(t('en', 'footer').visibleRegions(228), '228 visible regions');
  assert.equal(t('en', 'footer').visibleRegions(1), '1 visible region');
  assert.equal(t('fr', 'footer').visibleRegions(228), '228 régions visibles');
  assert.equal(t('fr', 'footer').visibleRegions(1), '1 région visible');
});

test('skip to model is the first focusable element on the page', () => {
  const app = html.indexOf('<div id="app"');
  const firstFocusable = html.slice(app).search(/<(a|button|select|input)\b/);
  assert.match(html.slice(app + firstFocusable), /^<a id="skip-to-model"/);
});

test('provenance opens a dialog, not a raw JSON file', () => {
  assert.match(tagWithId('provenance'), /^<button/);
  assert.match(tagWithId('provenance-dialog'), /^<dialog/);
  assert.equal(/href="models\/anatomies\.json" target/.test(html), false);
});

test('the T1 colouring is not named MRI beside the linked MRI command', () => {
  for (const lang of ['en', 'fr']) assert.equal(t(lang, 'display').surfaceColors.mri, 'T1');
});

test('snapshot and fullscreen sit in the masthead, not on the anatomy', () => {
  const masthead = html.indexOf('<header id="masthead"');
  const viewport = html.indexOf('<main id="viewport"');
  const fs = html.indexOf('id="viewport-fullscreen"');
  const snap = html.indexOf('id="viewport-snapshot"');
  assert.ok(masthead !== -1 && viewport !== -1 && fs !== -1 && snap !== -1);
  assert.ok(fs > masthead && fs < viewport);
  assert.ok(snap > masthead && snap < viewport);
});

test('snapshot and fullscreen retain accessible names with icon controls', () => {
  for (const id of ['viewport-fullscreen', 'viewport-snapshot']) {
    assert.match(tagWithId(id), /aria-label="[^"]+"/);
    const start = html.indexOf(`id="${id}"`);
    const button = html.slice(start, html.indexOf('</button>', start));
    assert.match(button, /class="masthead-action-label"/);
  }
});

test('deficit search is a flush rail field in the same slot as region search', () => {
  const head = tagWithId('deficit-search-head');
  assert.match(head, /\brail-head\b/);
  const anatomy = html.indexOf('id="anatomy-search"');
  const deficit = html.indexOf('id="deficit-search-head"');
  const browser = html.indexOf('id="deficit-browser"');
  assert.ok(anatomy !== -1 && deficit > anatomy && deficit < browser);
});

test('the cutting planes are one group named by the caption above them', () => {
  assert.match(tagWithId('cut-mode'), /aria-labelledby="cut-mode-label"/);
  assert.equal(/visually-hidden/.test(tagWithId('cut-mode-label')), false);
});

test('an empty inspector does not chart the whole cortex', async () => {
  const source = await readFile(new URL('./inspector.js', import.meta.url), 'utf8');
  assert.equal(/cortexShares|cortexHeading|wholeCortex/.test(source), false);
});

test('linked MRI is the filled member of the actions row, not a second banner', () => {
  const regionActions = html.match(/<div class="actions">\s*<button id="focus"[\s\S]*?<\/div>/);
  assert.ok(regionActions, 'expected the region actions row');
  assert.match(regionActions[0], /id="region-mpr"/);
  assert.equal(/button-primary/.test(tagWithId('mpr-open')), false, 'the stage command is tonal');
});

test('cuts panel has no midsagittal or face-cut shortcuts', () => {
  assert.equal(/id="cut-midline"/.test(html), false);
  assert.equal(/id="cut-face-view"/.test(html), false);
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

test('the region datasheet leaves the loaded atlas to the masthead', () => {
  assert.equal(/id="fact-atlas"/.test(html), false);
  assert.match(tagWithId('fact-source'), /\bmeasure\b/);
});

test('the tree scope is an exclusive choice, and By system says it hides the cortex', () => {
  const scope = tagWithId('tree-scope');
  assert.match(scope, /\bsegmented\b/);
  assert.match(scope, /role="group"/);
  const choices = [...html.matchAll(/<button type="button" data-scope="(\w+)" aria-pressed="(true|false)">([^<]*)</g)]
    .map(([, value, pressed, label]) => [value, pressed, label]);
  assert.deepEqual(choices, [['whole', 'true', 'Whole brain'], ['system', 'false', 'By system']]);
  assert.equal(/id="explore-internal"/.test(html), false);
  for (const lang of ['en', 'fr']) assert.match(t(lang, 'navigator').cortexHiddenNote, /cortex/i);
});
