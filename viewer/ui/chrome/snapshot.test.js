import assert from 'node:assert/strict';
import test from 'node:test';
import { SEPARATOR, bottomLine, ellipsize, packFacts, snapshotCaption } from './snapshot.js';

const words = lines => lines.map(line => line.map(runs => runs.map(run => run.text).join('')).join(SEPARATOR));

test('the caption names the subject, then atlas, colouring and internal anatomy as the masthead does', () => {
  const lines = snapshotCaption('en', {
    subject: 'SNAIL subj_1', atlas: 'destrieux', surfaceColor: 'tissue', detail: 'learning', view: 'anterior',
  });
  assert.deepEqual(words(lines), ['SNAIL subj_1', 'Destrieux · Tissue · Teaching set', 'Anterior view']);
  assert.equal(lines[0][0][0].strong, true);
});

test('a cut replaces the view with the section and its signed position in mono', () => {
  const lines = snapshotCaption('fr', {
    subject: 'SNAIL subj_1', atlas: 'hcp-mmp', surfaceColor: 'network', detail: null, view: 'oblique',
    section: { plane: 'coronal', offset: -12.34, tilt: 30, azimuth: 30 },
  });
  assert.equal(lines.length, 3);
  assert.equal(words(lines)[2], 'Coupe coronale · −12,3 mm');
  assert.deepEqual(lines[2].flat().filter(run => run.mono).map(run => run.text), ['−12,3 mm']);
});

test('an oblique section carries its tilt and azimuth', () => {
  const [, , section] = snapshotCaption('en', {
    subject: 'S', atlas: 'destrieux', surfaceColor: 'atlas',
    section: { plane: 'oblique', offset: 0, tilt: 30, azimuth: -45 },
  });
  assert.equal(words([section])[0], 'Oblique section · 0.0 mm · Tilt 30° · Azimuth −45°');
});

test('the tract reference is named alone, and a camera off every preset names no view', () => {
  const lines = snapshotCaption('en', { reference: 'HCP tract reference', view: null });
  assert.deepEqual(words(lines), ['HCP tract reference']);
});

test('the French view agrees with « vue »', () => {
  const [, , view] = snapshotCaption('fr', { subject: 'S', atlas: 'destrieux', surfaceColor: 'mri', view: 'posterior' });
  assert.equal(words([view])[0], 'Vue postérieure');
});

test('a narrow image breaks a caption line between its facts, never inside one', () => {
  // Destrieux · Regions · Teaching set at 10px a character, a 3-character separator.
  assert.deepEqual(packFacts([90, 70, 120], 30, 400), [[0, 1, 2]]);
  assert.deepEqual(packFacts([90, 70, 120], 30, 200), [[0, 1], [2]]);
  assert.deepEqual(packFacts([90, 70, 120], 30, 100), [[0], [1], [2]]);
  // A fact wider than the room still gets a line of its own, to be shortened there.
  assert.deepEqual(packFacts([300, 70], 30, 100), [[0], [1]]);
});

test('a line too long for its room keeps its start and ends in an ellipsis', () => {
  const measure = text => text.length * 10;
  assert.equal(ellipsize('Destrieux', 200, measure), 'Destrieux');
  assert.equal(ellipsize('Destrieux · Tissue', 100, measure), 'Destrieux…');
  assert.ok(measure(ellipsize('Destrieux · Tissue', 100, measure)) <= 100);
  assert.equal(ellipsize('Destrieux', 5, measure), '…');
});

test('statement and scale bar share the bottom line until they would meet', () => {
  const wide = bottomLine({ width: 1120, height: 824, statementWidth: 190, scaleWidth: 110 });
  assert.deepEqual(wide.statement, { x: 16, y: 800 });
  assert.deepEqual(wide.scale, { x: 994, y: 800 });
  const narrow = bottomLine({ width: 300, height: 600, statementWidth: 190, scaleWidth: 110 });
  assert.equal(narrow.scale.y, 576 - 16 - 8);
  assert.equal(narrow.scale.x + 110, 300 - 16);
});
