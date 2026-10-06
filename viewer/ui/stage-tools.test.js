import assert from 'node:assert/strict';
import test from 'node:test';
import { dockArrangement, placePopover } from './stage-tools.js';

const desktop = { x: 0, y: 0, width: 1120, height: 824 };

test('a popover opens above its button with its left edge on the button', () => {
  const spot = placePopover({
    anchor: { left: 360 }, toolbar: { left: 16, top: 770 }, visible: desktop, width: 288,
  });
  assert.deepEqual(spot, { left: 344, width: 288, maxHeight: 746 });
});

test('a popover near the right edge slides left to stay inside the visible stage', () => {
  const spot = placePopover({
    anchor: { left: 1000 }, toolbar: { left: 16, top: 770 }, visible: desktop, width: 288,
  });
  assert.equal(spot.left + 16 + spot.width, 1120 - 16);
});

test('on a phone a popover fills the stage between 16px gutters and leaves the top third of it in sight', () => {
  // The sheet covers the lower canvas, so the visible rectangle is short.
  const visible = { x: 0, y: 0, width: 390, height: 600 };
  const spot = placePopover({
    anchor: { left: 300 }, toolbar: { left: 16, top: 540 }, visible, width: 288, fill: true,
  });
  assert.deepEqual(spot, { left: 0, width: 358, maxHeight: 352 });
});

test('a side sheet moves the visible stage, and the popover with it', () => {
  // Landscape phone: the sheet sits at the left and the stage starts after it.
  const visible = { x: 220, y: 0, width: 624, height: 338 };
  const spot = placePopover({
    anchor: { left: 120 }, toolbar: { left: 236, top: 282 }, visible, width: 288,
  });
  assert.equal(spot.left + 236, visible.x + 16, 'never under the sheet');
  assert.equal(spot.maxHeight, 258);
});

test('a stage too narrow for the popover never yields a negative size', () => {
  const spot = placePopover({
    anchor: { left: 0 }, toolbar: { left: 0, top: 10 }, visible: { x: 0, y: 0, width: 20, height: 20 }, width: 288,
  });
  assert.equal(spot.width, 0);
  assert.equal(spot.maxHeight, 0);
});

test('the presets stay inline only while the tools fit beside them, never as a clipped strip', () => {
  assert.equal(dockArrangement({ room: 1088, needs: { tools: 640, section: 0 } }).menu, false);
  assert.equal(dockArrangement({ room: 640, needs: { tools: 640, section: 0 } }).menu, false);
  assert.equal(dockArrangement({ room: 639, needs: { tools: 640, section: 0 } }).menu, true);
});

test('the section bar folds its details behind the disclosure when its row would wrap', () => {
  assert.equal(dockArrangement({ room: 748, needs: { tools: 600, section: 700 } }).compact, false);
  assert.equal(dockArrangement({ room: 488, needs: { tools: 600, section: 700 } }).compact, true);
  // A wide plane row does not push the presets into the chooser on its own.
  assert.equal(dockArrangement({ room: 650, needs: { tools: 600, section: 700 } }).menu, false);
});

test('a phone always takes the chooser and the compact section bar', () => {
  assert.deepEqual(dockArrangement({ room: 358, needs: null }), { menu: true, compact: true });
});
