import assert from 'node:assert/strict';
import test from 'node:test';
import { fitScale, viewOffset, visibleRect } from './effective-viewport.js';

const canvas = { width: 400, height: 800 };

test('an uncovered canvas is entirely visible', () => {
  assert.deepEqual(visibleRect(canvas), { x: 0, y: 0, width: 400, height: 800 });
});

test('a bottom sheet takes height from the bottom only', () => {
  assert.deepEqual(
    visibleRect(canvas, { bottom: 300 }),
    { x: 0, y: 0, width: 400, height: 500 },
  );
});

test('a side sheet takes width from the left only', () => {
  assert.deepEqual(
    visibleRect(canvas, { left: 160 }),
    { x: 160, y: 0, width: 240, height: 800 },
  );
});

test('a masthead and a sheet both inset the same rectangle', () => {
  assert.deepEqual(
    visibleRect(canvas, { top: 52, bottom: 148 }),
    { x: 0, y: 52, width: 400, height: 600 },
  );
});

test('insets that would consume the canvas are scaled back, never inverted', () => {
  const rect = visibleRect(canvas, { bottom: 900 });
  assert.equal(rect.height, 80, 'a tenth of the canvas is kept');
  assert.ok(rect.height > 0);
  assert.equal(rect.y, 0);
});

test('over-large insets keep their proportions when scaled back', () => {
  const rect = visibleRect(canvas, { top: 400, bottom: 1200 });
  // 1600 requested into 720 allowed: both shrink by the same factor.
  assert.equal(Math.round(rect.y), 180);
  assert.equal(Math.round(rect.height), 80);
});

test('a degenerate canvas reports nothing rather than a negative rectangle', () => {
  assert.deepEqual(visibleRect({ width: 0, height: 0 }), { x: 0, y: 0, width: 0, height: 0 });
  assert.deepEqual(visibleRect(null), { x: 0, y: 0, width: 0, height: 0 });
});

test('negative insets are treated as absent', () => {
  assert.deepEqual(visibleRect(canvas, { bottom: -50 }), { x: 0, y: 0, width: 400, height: 800 });
});

test('fit scale is the fraction of each axis left visible', () => {
  const rect = visibleRect(canvas, { bottom: 400 });
  assert.deepEqual(fitScale(canvas, rect), { horizontal: 1, vertical: 0.5 });
});

test('fit scale of an uncovered canvas leaves framing unchanged', () => {
  assert.deepEqual(fitScale(canvas, visibleRect(canvas)), { horizontal: 1, vertical: 1 });
});

test('a centred rectangle needs no view offset', () => {
  assert.equal(viewOffset(canvas, visibleRect(canvas)), null);
  assert.equal(viewOffset(canvas, visibleRect(canvas, { top: 100, bottom: 100 })), null);
});

test('a bottom sheet shifts the image up by half the covered height', () => {
  const offset = viewOffset(canvas, visibleRect(canvas, { bottom: 300 }));
  // Visible centre is 150px above the canvas centre, so the frustum moves down.
  assert.equal(offset.offsetY, 150);
  assert.equal(offset.offsetX, 0);
  assert.equal(offset.fullHeight, 800);
  assert.equal(offset.height, 800, 'the frustum is shifted, never narrowed');
});

test('a left sheet shifts the image right by half the covered width', () => {
  const offset = viewOffset(canvas, visibleRect(canvas, { left: 160 }));
  assert.equal(offset.offsetX, -80);
  assert.equal(offset.offsetY, 0);
});

test('a degenerate canvas has no view offset', () => {
  assert.equal(viewOffset({ width: 0, height: 0 }, { x: 0, y: 0, width: 0, height: 0 }), null);
});
