import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import {
  COARSE_POINTER_QUERY,
  CUTS,
  EXPLORERS,
  FUNCTIONAL_LEVELS,
  HEMISPHERES,
  MODES,
  PHONE_DEVICE_QUERY,
  PHONE_QUERY,
  SURFACE_COLORS,
  VIEW_NAMES,
} from './constants.ts';

const sourceRoot = new URL('../../', import.meta.url);

describe('the fixed lists', () => {
  it('CAT-01: the seven camera presets are in the order the view menu and keys 1 to 6 follow', () => {
    assert.deepStrictEqual(
      [...VIEW_NAMES],
      ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'],
    );
  });

  it('CAT-02: section modes, hemispheres and functional levels', () => {
    assert.deepStrictEqual([...CUTS], ['off', 'sagittal', 'coronal', 'axial', 'oblique']);
    assert.deepStrictEqual([...HEMISPHERES], ['both', 'left', 'right']);
    assert.deepStrictEqual([...FUNCTIONAL_LEVELS], ['named', 'sections']);
  });

  it('CAT-03: six surface colourings', () => {
    assert.deepStrictEqual(
      [...SURFACE_COLORS],
      ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional'],
    );
  });

  it('CAT-04: five explorers, which are the workspace modes', () => {
    const tabs = ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion'];
    assert.deepStrictEqual([...EXPLORERS], tabs);
    assert.deepStrictEqual([...MODES], tabs);
  });
});

describe('CAT-05: the media queries', () => {
  it('are one literal each', () => {
    assert.equal(
      PHONE_QUERY,
      '(max-width: 800px), (max-height: 480px) and (orientation: landscape)',
    );
    assert.equal(
      PHONE_DEVICE_QUERY,
      '(max-width: 640px), (max-height: 480px) and (orientation: landscape)',
    );
    assert.equal(COARSE_POINTER_QUERY, '(pointer: coarse)');
  });

  it('every compact-layout @media block in the stylesheets and components uses the PHONE_QUERY literal', () => {
    const files = (readdirSync(sourceRoot, { recursive: true }) as string[]).filter((name) =>
      /\.(css|svelte)$/.test(name),
    );
    let compact = 0;
    for (const name of files) {
      for (const line of readFileSync(new URL(name, sourceRoot), 'utf8').split('\n')) {
        if (!line.includes('@media') || !line.includes('800px')) continue;
        compact++;
        assert.ok(line.includes(`${PHONE_QUERY} {`), `${name}: ${line.trim()}`);
      }
    }
    assert.ok(compact >= 20, `only ${compact} compact-layout blocks found`);
  });
});
