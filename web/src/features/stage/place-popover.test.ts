// placePopover against the legacy cases (stage-tools.test.js:8-44).
import { describe, expect, test } from 'vitest';
import { placePopover } from './place-popover.ts';

const desktop = { x: 0, y: 0, width: 1120, height: 824 };

describe('placePopover', () => {
  test('opens above the dock on its start edge, whichever tool opened it', () => {
    expect(placePopover({ toolbar: { left: 16, top: 770 }, visible: desktop, width: 288 })).toEqual(
      { left: 0, width: 288, maxHeight: 746 },
    );
  });

  test('a popover wider than the room right of the dock slides left to stay inside the visible stage', () => {
    const visible = { x: 0, y: 0, width: 420, height: 824 };
    const spot = placePopover({ toolbar: { left: 200, top: 770 }, visible, width: 288 });
    expect(spot.left + 200 + spot.width).toBe(420 - 16);
  });

  test('on a phone it fills the stage between the gutters and leaves the top third in sight', () => {
    // The sheet covers the lower canvas, so the visible rectangle is short.
    const visible = { x: 0, y: 0, width: 390, height: 600 };
    expect(
      placePopover({ toolbar: { left: 16, top: 540 }, visible, width: 288, fill: true }),
    ).toEqual({ left: 0, width: 358, maxHeight: 352 });
  });

  test('a side sheet moves the visible stage, and the popover with it', () => {
    // Landscape phone: the sheet sits at the left and the stage starts after it.
    const visible = { x: 220, y: 0, width: 624, height: 338 };
    const spot = placePopover({ toolbar: { left: 236, top: 282 }, visible, width: 288 });
    expect(spot.left + 236, 'never under the sheet').toBe(visible.x + 16);
    expect(spot.maxHeight).toBe(258);
  });

  test('a stage too narrow for the popover never yields a negative size', () => {
    const spot = placePopover({
      toolbar: { left: 0, top: 10 },
      visible: { x: 0, y: 0, width: 20, height: 20 },
      width: 288,
    });
    expect(spot.width).toBe(0);
    expect(spot.maxHeight).toBe(0);
  });
});
