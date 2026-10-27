import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { centeredFrame } from './slices/coordinates.ts';
import { createEngineSections } from './adapters.ts';

/** Only what `mriWindowLink` reads of the sections object. */
function link(display: object | null, published: object | null) {
  const stub = {
    display,
    volumes: published && { metadata: { display: published } },
    state: { crosshair: [0, 0, 0] },
    frame: centeredFrame('axial', [0, 0, 0]),
  };
  return createEngineSections(stub as never).mriWindowLink();
}

const PUBLISHED = { window_center: 94, window_width: 188 };

describe('the MRI window link', () => {
  it('FACADE-37 is null before the linked MRI has loaded', () => {
    assert.equal(link({ windowCenter: 104, windowWidth: 208 }, null), null);
    assert.equal(link(null, PUBLISHED), null);
  });

  it('FACADE-37 is null while the published window is shown', () => {
    assert.equal(link({ windowCenter: 94, windowWidth: 188 }, PUBLISHED), null);
  });

  it('FACADE-37 carries the window once it differs, even by one in the centre or the width alone', () => {
    assert.deepEqual(link({ windowCenter: 104, windowWidth: 208 }, PUBLISHED), {
      center: 104,
      width: 208,
    });
    assert.deepEqual(link({ windowCenter: 95, windowWidth: 188 }, PUBLISHED), {
      center: 95,
      width: 188,
    });
    assert.deepEqual(link({ windowCenter: 94, windowWidth: 189 }, PUBLISHED), {
      center: 94,
      width: 189,
    });
  });
});
