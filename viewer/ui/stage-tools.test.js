import assert from 'node:assert/strict';
import test from 'node:test';
import { overflowCue, placePopover, revealDelta } from './stage-tools.js';

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

test('a scroller cues only the edges that still hide content', () => {
  assert.equal(overflowCue({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }), '');
  assert.equal(overflowCue({ scrollLeft: 0, scrollWidth: 400, clientWidth: 300 }), 'end');
  assert.equal(overflowCue({ scrollLeft: 50, scrollWidth: 400, clientWidth: 300 }), 'both');
  assert.equal(overflowCue({ scrollLeft: 100, scrollWidth: 400, clientWidth: 300 }), 'start');
});

test('a revealed preset clears the fade on the edge it was hidden past', () => {
  const frame = { left: 0, right: 300 };
  assert.equal(revealDelta(frame, { left: 100, right: 160 }, 20), 0);
  assert.equal(revealDelta(frame, { left: 310, right: 360 }, 20), 80);
  assert.equal(revealDelta(frame, { left: -40, right: 10 }, 20), -60);
});
