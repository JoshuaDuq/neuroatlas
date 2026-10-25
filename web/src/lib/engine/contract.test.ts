import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type { Manifest } from '../types/index.ts';
import type { CabNpData, FunctionalRegionsData } from './api.ts';
import { defineEngineContract } from './fake/contract-suite.ts';
import { createFakeEngine } from './fake.ts';

const published = manifest as unknown as Manifest;
const cabNp: CabNpData = { atlas: 'hcp-mmp', regions: {} };
const functionalRegions: FunctionalRegionsData = { atlas: 'hcp-mmp' };

const create = () => createFakeEngine({ manifest: published, cabNp, functionalRegions });

// The fake ignores the canvas; a DOM is not needed to run the suite.
defineEngineContract('fake', create, { canvas: {} as HTMLCanvasElement });

describe('the fake engine', () => {
  it('records the application’s calls in order, and no getter or event', () => {
    const engine = create();
    engine.model.setHemisphere('left');
    engine.camera.applyView('left');
    engine.present({ lang: 'fr', referenceOnly: false });
    const unused = engine.model.settings;
    assert.ok(unused);
    assert.deepEqual(
      engine.calls.map(({ domain, method }) => `${domain}.${method}`),
      ['model.setHemisphere', 'camera.applyView', 'engine.present'],
    );
    assert.deepEqual(engine.calls[0]!.args, ['left']);
    assert.deepEqual(engine.presented, { lang: 'fr', referenceOnly: false });
  });

  it('delivers the events only the pointer or the GPU would raise', () => {
    const engine = create();
    const heard: unknown[] = [];
    engine.on('pick', (event) => heard.push(event));
    engine.on('contextLost', () => heard.push('lost'));
    engine.emit('pick', { id: 'a' });
    engine.emit('contextLost', undefined);
    assert.deepEqual(heard, [{ id: 'a' }, 'lost']);
  });

  it('reports a tract reference of another anatomy as active', async () => {
    const engine = createFakeEngine({ manifest: published, tractAnatomy: 'another' });
    const active: boolean[] = [];
    engine.on('tractsActive', ({ active: value }) => active.push(value));
    await engine.tracts.setActive(true);
    await engine.tracts.setActive(false);
    assert.deepEqual(active, [true, false]);
  });

  it('links no orbit while the tract reference is shown', async () => {
    const engine = createFakeEngine({ manifest: published, tractAnatomy: 'another' });
    engine.camera.orbitBy({ azimuth: 0.1 });
    assert.ok(engine.camera.orbitLink());
    await engine.tracts.setActive(true);
    assert.equal(engine.camera.orbitLink(), null);
  });

  it('highlights an overlap until it is cleared or hidden', async () => {
    const engine = create();
    const geometry = { file: 'atlas-overlaps.glb', sha256: '0'.repeat(64) };
    assert.equal(await engine.comparison.highlight('a-b', geometry), true);
    assert.equal(engine.highlighted, 'a-b');
    engine.comparison.setVisible(false);
    assert.equal(engine.highlighted, null);
    engine.comparison.setVisible(true);
    engine.comparison.clear();
    assert.equal(engine.highlighted, null);
  });

  it('sizes a snapshot canvas to the crop', () => {
    const canvases: { width: number; height: number }[] = [];
    vi.stubGlobal('document', {
      createElement: () => canvases[canvases.push({ width: 0, height: 0 }) - 1],
    });
    const { canvas, ratio } = create().captureSnapshot({ x: 0, y: 0, width: 100, height: 80 });
    assert.equal(ratio, 1);
    assert.deepEqual([canvas.width, canvas.height], [100, 80]);
    vi.unstubAllGlobals();
  });

  it('needs a DOM or a canvas to give one', () => {
    assert.throws(() => create().canvas, /no canvas outside a DOM/);
  });
});
