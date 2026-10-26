import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { clinicalLayers, showClinicalRegions } from './clinical-navigation.ts';
import type { ShowingModel } from './clinical-navigation.ts';

function scene(...regions: Pick<Region, 'id' | 'atlas' | 'kind'>[]) {
  const calls: unknown[][] = [];
  const settings = { atlas: 'hcp-mmp', detail: 'nextbrain', cortexOpacity: 0 };
  const model = {
    regions: new Map(regions.map((region) => [region.id, region])),
    settings,
    setInternalSystem: (value: unknown) => calls.push(['system', value]),
    setInternalVisible: (value: unknown) => calls.push(['internal', value]),
    clearIsolation: () => calls.push(['clearIsolation']),
    setHemisphere: (side: unknown) => calls.push(['hemisphere', side]),
    setCortexVisible: (value: unknown) => calls.push(['cortex', value]),
    setCortexOpacity: (value: unknown) => calls.push(['opacity', value]),
    showRegions: (ids: unknown) => calls.push(['show', ids]),
  } as unknown as ShowingModel;
  return { model, calls, settings };
}

test('cortical evidence needs its atlas; the loaded one is kept while it draws any of it', () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' } as const;
  const { model, settings } = scene(region);
  assert.deepEqual(clinicalLayers(model, [region.id]), { atlas: 'destrieux', detail: null });
  settings.atlas = 'destrieux';
  assert.deepEqual(clinicalLayers(model, [region.id]), { atlas: null, detail: null });
});

test('a deficit draws its mapped regions in the detail level holding most of them', () => {
  const regions = [
    { id: 'destrieux:right:26', atlas: 'destrieux', kind: 'cortex' },
    { id: 'aseg:right:49', atlas: 'aseg', kind: 'structure' },
    { id: 'aseg:right:50', atlas: 'aseg', kind: 'structure' },
    { id: 'nextbrain:right:7', atlas: 'nextbrain', kind: 'structure' },
  ] as const;
  const { model, settings } = scene(...regions);
  const ids = regions.map((region) => region.id);
  settings.detail = 'learning';
  assert.deepEqual(clinicalLayers(model, ids), { atlas: 'destrieux', detail: 'aseg' });
  settings.detail = 'nextbrain';
  assert.equal(clinicalLayers(model, ids).detail, null);
});

test('an unknown or non-anatomical citation is an error, not a guess', () => {
  const { model } = scene({ id: 'wall', atlas: 'destrieux', kind: 'non-region' });
  assert.throws(() => clinicalLayers(model, ['unknown']), /Unknown clinical region: unknown/);
  assert.throws(() => showClinicalRegions(model, ['wall']), /Unknown clinical region: wall/);
});

test('cortical evidence is shown with the cortex opaque and nothing isolating it', () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' } as const;
  const { model, calls } = scene(region);
  showClinicalRegions(model, [region.id]);
  assert.deepEqual(calls, [
    ['clearIsolation'],
    ['system', null],
    ['hemisphere', 'both'],
    ['cortex', true],
    ['opacity', 1],
    ['show', [region.id]],
  ]);
});

test('deep-only mappings hide the occluding cortex and show the internal anatomy', () => {
  const region = { id: 'aseg:left:17', atlas: 'aseg', kind: 'structure' } as const;
  const { model, calls } = scene(region);
  showClinicalRegions(model, [region.id]);
  assert.deepEqual(calls, [
    ['clearIsolation'],
    ['system', null],
    ['hemisphere', 'both'],
    ['cortex', false],
    ['internal', true],
    ['show', [region.id]],
  ]);
  const empty = scene(region);
  showClinicalRegions(empty.model, []);
  assert.deepEqual(empty.calls, []);
});

test('the commonest atlas is chosen, not the rarest', () => {
  const regions = [
    { id: 'a:1', atlas: 'a', kind: 'cortex' },
    { id: 'b:1', atlas: 'b', kind: 'cortex' },
    { id: 'b:2', atlas: 'b', kind: 'cortex' },
  ] as const;
  const { model } = scene(...regions);
  assert.equal(
    clinicalLayers(
      model,
      regions.map((region) => region.id),
    ).atlas,
    'b',
  );
});

test('STATE-51 a layer none of the citations needs is left alone', () => {
  const cortex = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' } as const;
  const structure = { id: 'aseg:right:49', atlas: 'aseg', kind: 'structure' } as const;
  const { model, settings } = scene(cortex, structure);
  settings.detail = 'learning';
  assert.deepEqual(clinicalLayers(model, [structure.id]), { atlas: null, detail: 'aseg' });
  assert.deepEqual(clinicalLayers(model, [cortex.id]), { atlas: 'destrieux', detail: null });
});
