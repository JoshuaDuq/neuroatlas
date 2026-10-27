import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { Mesh } from 'three';
import type { Region } from '../types/index.ts';
import { createPresentation } from './presentation.ts';

/** Four regions with two meshes each, and every call the presentation makes recorded in order. */
function fixture() {
  const ids = ['a', 'b', 'c', 'd'];
  const regions = new Map(ids.map((id) => [id, { id } as Region]));
  const meshes = ids.flatMap((id) =>
    [0, 1].map(() => Object.assign(new Mesh(), { userData: { region_id: id } })),
  );
  const first = (id: string) => meshes.find((mesh) => mesh.userData['region_id'] === id)!;
  const state = {
    selected: null as string | null,
    blocked: new Set<string>(),
    cut: false,
    reference: false,
    overlap: [] as Mesh[],
  };
  const log: unknown[][] = [];
  const presentation = createPresentation({
    scene: {
      setOutlined: (outlined) => log.push(['outlined', outlined]),
      invalidate: () => log.push(['invalidate']),
    },
    model: {
      get state() {
        return { selectedRegion: state.selected ? regions.get(state.selected) : null } as never;
      },
      visibleMeshes: meshes,
      canSelect: (region) => !state.blocked.has(region.id),
    },
    sections: {
      get active() {
        return state.cut;
      },
      setHighlight: (highlight) => log.push(['highlight', highlight]),
    },
    overlay: {
      get outlined() {
        return state.overlap;
      },
    },
    referenceActive: () => state.reference,
    emit: ((type: string, event: { region: Region | null; position: unknown }) => {
      if (type === 'hover') log.push(['hover', event.region?.id ?? null, event.position]);
    }) as never,
  });
  const only = (kind: string) => log.filter(([name]) => name === kind);
  return { presentation, regions, state, log, only, first };
}

describe('hover and selection marking', () => {
  it('FACADE-28 hovering a region names it with the pointer and outlines it', () => {
    const { presentation, regions, only, first } = fixture();
    presentation.hover(regions.get('a')!, { x: 10, y: 20 });
    assert.deepEqual(only('hover'), [['hover', 'a', { x: 10, y: 20 }]]);
    assert.deepEqual(only('outlined'), [['outlined', { selected: [], hovered: [first('a')] }]]);
  });

  it('FACADE-28 moving within the same region only moves the name, without a new outline', () => {
    const { presentation, regions, only } = fixture();
    presentation.hover(regions.get('a')!, { x: 10, y: 20 });
    presentation.hover(regions.get('a')!, { x: 30, y: 40 });
    assert.equal(only('outlined').length, 1);
    assert.deepEqual(only('hover').at(-1), ['hover', 'a', { x: 30, y: 40 }]);
  });

  it('FACADE-28 a region the reader cannot select is not hovered at the next outline pass', () => {
    const { presentation, regions, state, only } = fixture();
    presentation.hover(regions.get('a')!, { x: 10, y: 20 });
    state.blocked.add('a');
    presentation.outline();
    assert.deepEqual(only('hover').at(-1), ['hover', null, null]);
  });

  it('FACADE-28 leaving the canvas names nothing', () => {
    const { presentation, regions, only } = fixture();
    presentation.hover(regions.get('a')!, { x: 10, y: 20 });
    presentation.hover(null, null);
    assert.deepEqual(only('hover').at(-1), ['hover', null, null]);
  });

  it('FACADE-29 on the surface the selection is outlined and the hovered region gets the halo', () => {
    const { presentation, regions, state, only, first } = fixture();
    state.selected = 'b';
    presentation.hover(regions.get('c')!, { x: 1, y: 2 });
    assert.deepEqual(only('outlined').at(-1), [
      'outlined',
      { selected: [first('b')], hovered: [first('c')] },
    ]);
    assert.deepEqual(only('highlight').at(-1), ['highlight', { hovered: 'c', selected: 'b' }]);
  });

  it('FACADE-29 while a cut is open nothing is outlined and the cut faces light the regions', () => {
    const { presentation, regions, state, only } = fixture();
    state.cut = true;
    state.selected = 'b';
    presentation.hover(regions.get('c')!, { x: 1, y: 2 });
    presentation.outline();
    assert.deepEqual(only('outlined'), [['outlined', undefined]]);
    assert.deepEqual(only('highlight').at(-1), ['highlight', { hovered: 'c', selected: 'b' }]);
  });

  it('FACADE-29 while the tract reference is shown alone nothing is outlined or lit', () => {
    const { presentation, regions, state, only } = fixture();
    state.reference = true;
    state.selected = 'b';
    presentation.hover(regions.get('c')!, { x: 1, y: 2 });
    presentation.outline();
    assert.deepEqual(only('outlined'), [
      ['outlined', undefined],
      ['outlined', undefined],
    ]);
    assert.deepEqual(only('highlight'), []);
  });

  it('FACADE-29 an open overlap is outlined in place of the selection', () => {
    const { presentation, state, only, first } = fixture();
    const overlap = new Mesh();
    state.selected = 'b';
    state.overlap = [overlap];
    presentation.outline();
    assert.deepEqual(only('outlined').at(-1), ['outlined', { selected: [overlap], hovered: [] }]);
    assert.notEqual(first('b'), overlap);
  });
});
