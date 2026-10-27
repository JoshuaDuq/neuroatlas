import assert from 'node:assert/strict';
import { Data3DTexture, DataTexture, Matrix4, Vector2, Vector3 } from 'three';
import { test } from 'vitest';
import { asDisplaySettings } from '../../core/catalog/test-support.ts';
import { createCapLabels, updateCapLabels } from './cap-labels.ts';
import type { CutLayer } from './cap-labels.ts';

const layer = (wedged: boolean): CutLayer => ({
  texture: new Data3DTexture(new Uint8Array(8), 2, 2, 2),
  palette: new DataTexture(new Uint8Array(4), 4, 1),
  wedged,
  uniforms: {
    worldToVoxel: { value: new Matrix4().makeTranslation(1, 2, 3) },
    volumeShape: { value: new Vector3(2, 2, 2) },
    highlightCodes: { value: new Vector2(1, 2) },
    highlightLifts: { value: new Vector2(0.26, 0.45) },
  },
});

test('SHADER-30 new cap labels are off and empty', () => {
  const caps = createCapLabels();
  assert.equal(caps.capLabelsEnabled.value, false);
  assert.equal(caps.capLabelVolume.value, null);
  assert.equal(caps.capLabelPalette.value, null);
  assert.deepEqual(caps.capHighlightCodes.value.toArray(), [-1, -1]);
  assert.deepEqual(caps.capHighlightLifts.value.toArray(), [0, 0]);
  assert.equal(caps.capIsolated.value, false);
});

test('SHADER-30 caps sample the cut labels only under MRI colour on an atlas without parcel solids, and share the layer own objects', () => {
  const state = (surfaceColor: string, isolatedRegion: string | null = null) =>
    asDisplaySettings({ surfaceColor, isolatedRegion });
  const enabled = (surfaceColor: string, wedged: boolean) => {
    const caps = createCapLabels();
    updateCapLabels(caps, layer(wedged), state(surfaceColor));
    return caps.capLabelsEnabled.value;
  };
  assert.equal(enabled('mri', false), true);
  assert.equal(enabled('atlas', false), false);
  assert.equal(enabled('mri', true), false);

  const own = layer(false);
  const caps = createCapLabels();
  updateCapLabels(caps, own, state('mri', 'destrieux:left:1'));
  assert.equal(caps.capLabelVolume.value, own.texture);
  assert.equal(caps.capLabelPalette.value, own.palette);
  assert.equal(caps.capWorldToLabels.value, own.uniforms.worldToVoxel.value);
  assert.equal(caps.capLabelShape.value, own.uniforms.volumeShape.value);
  assert.equal(caps.capHighlightCodes.value, own.uniforms.highlightCodes.value);
  assert.equal(caps.capHighlightLifts.value, own.uniforms.highlightLifts.value);
  assert.equal(caps.capIsolated.value, true);
});
