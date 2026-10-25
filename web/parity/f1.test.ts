import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { VIEW_DIRECTIONS } from '../../viewer/render/camera-views.js';
import { PHONE_QUERY as LEGACY_PHONE_QUERY } from '../../viewer/render/device.js';
import { SURFACE_COLORS as LEGACY_SURFACE_COLORS } from '../../viewer/model/brain-atlas.js';
import { decodeState } from '../../viewer/state/url-state.js';
import { MODES as LEGACY_MODES } from '../../viewer/ui/chrome/workspace.js';
import {
  CUTS,
  EXPLORERS,
  FUNCTIONAL_LEVELS,
  HEMISPHERES,
  MODES,
  PHONE_QUERY,
  SURFACE_COLORS,
  VIEW_NAMES,
} from '../src/lib/types/constants.ts';

/** url-state.js keeps its value lists private, so they are read through `decodeState`. */
const accepted = (param: string, candidates: readonly string[]) =>
  candidates.filter((value) => !decodeState(`${param}=${value}`).rejected.length);

describe('F1 constants against the legacy modules', () => {
  it('VIEW_NAMES are the legacy view directions, in order', () => {
    assert.deepStrictEqual([...VIEW_NAMES], Object.keys(VIEW_DIRECTIONS));
  });

  it('SURFACE_COLORS equal the legacy list in brain-atlas.js', () => {
    assert.deepStrictEqual([...SURFACE_COLORS], LEGACY_SURFACE_COLORS);
  });

  it('MODES equal the legacy list in workspace.js, and EXPLORERS are the same list', () => {
    assert.deepStrictEqual([...MODES], LEGACY_MODES);
    assert.deepStrictEqual([...EXPLORERS], LEGACY_MODES);
  });

  it('url-state.js accepts exactly CUTS, HEMISPHERES, FUNCTIONAL_LEVELS and EXPLORERS', () => {
    const probes = [
      'off',
      'sagittal',
      'coronal',
      'axial',
      'oblique',
      'both',
      'left',
      'right',
      'named',
      'sections',
      'anatomy',
      'functions',
      'deficits',
      'circuits',
      'diffusion',
      'bogus',
      '',
    ];
    assert.deepStrictEqual(accepted('cut', probes), [...CUTS]);
    assert.deepStrictEqual(accepted('hemi', probes), [...HEMISPHERES]);
    assert.deepStrictEqual(accepted('level', probes), [...FUNCTIONAL_LEVELS]);
    assert.deepStrictEqual(accepted('tab', probes), [...EXPLORERS]);
  });

  it('url-state.js accepts every SURFACE_COLORS value and nothing else of the probes', () => {
    const probes = [...SURFACE_COLORS, 'bogus', 'rgb'];
    assert.deepStrictEqual(accepted('colors', probes), [...SURFACE_COLORS]);
  });

  it('PHONE_QUERY equals device.js', () => {
    assert.equal(PHONE_QUERY, LEGACY_PHONE_QUERY);
  });

  it('PHONE_QUERY is the literal the legacy stylesheets repeat', () => {
    for (const sheet of ['phone', 'stage', 'dialogs', 'masthead']) {
      const css = readFileSync(
        new URL(`../../viewer/styles/${sheet}.css`, import.meta.url),
        'utf8',
      );
      assert.ok(css.includes(`@media ${PHONE_QUERY} {`), `${sheet}.css lacks the phone query`);
    }
  });
});
