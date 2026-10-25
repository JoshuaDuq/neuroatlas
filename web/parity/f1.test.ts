import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, vi } from 'vitest';
import manifest from '../../public/models/cdmd/manifest.json' with { type: 'json' };
import { VIEW_DIRECTIONS } from '../../viewer/render/camera-views.js';
import {
  isCoarse,
  isPhone,
  PHONE_QUERY as LEGACY_PHONE_QUERY,
} from '../../viewer/render/device.js';
import { SURFACE_COLORS as LEGACY_SURFACE_COLORS } from '../../viewer/model/brain-atlas.js';
import { decodeState } from '../../viewer/state/url-state.js';
import { MODES as LEGACY_MODES } from '../../viewer/ui/chrome/workspace.js';
import type {
  Manifest,
  ManifestAnatomy,
  ManifestAppearance,
  ManifestAtlas,
  ManifestCutAtlas,
  ManifestDetailLevel,
  ManifestSupplementalLayer,
  Region,
} from '../src/lib/types/index.ts';
import {
  COARSE_POINTER_QUERY,
  PHONE_DEVICE_QUERY,
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

  it('PHONE_DEVICE_QUERY and COARSE_POINTER_QUERY are the queries isPhone and isCoarse ask', () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      isPhone();
      isCoarse();
      assert.deepStrictEqual(matchMedia.mock.calls, [[PHONE_DEVICE_QUERY], [COARSE_POINTER_QUERY]]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/**
 * The published manifest, assigned to the types: `npm run check` fails here when a type
 * stops describing the data. JSON widens the literal unions, so `regions` is checked at
 * run time and then narrowed.
 */
describe('F1 manifest types against the published manifest', () => {
  it('the cdmd manifest fits the Manifest sections', () => {
    const atlases: ManifestAtlas[] = manifest.atlases;
    const levels: ManifestDetailLevel[] = manifest.detail_levels;
    // JSON arrays are not tuples: the two-corner shape is the only field narrowed.
    const layers: ManifestSupplementalLayer[] = manifest.supplemental_layers.map((layer) => ({
      ...layer,
      bounds_ras_mm: layer.bounds_ras_mm as [number[], number[]],
    }));
    const cutAtlases: ManifestCutAtlas[] = manifest.cut_atlases;
    const appearance: ManifestAppearance = manifest.appearance;
    const anatomy: ManifestAnatomy = manifest.anatomy;
    assert.ok(atlases.length && levels.length && layers.length && cutAtlases.length);
    assert.equal(appearance.tissue !== undefined && anatomy.id, 'cdmd');
    const kinds = ['cortex', 'structure', 'non-region', 'tissue-region'];
    const hemispheres = ['left', 'right', 'midline'];
    for (const region of manifest.regions) {
      assert.ok(kinds.includes(region.kind) && hemispheres.includes(region.hemisphere), region.id);
    }
    const regions: Region[] = manifest.regions.map((region) => ({
      ...region,
      hemisphere: region.hemisphere as Region['hemisphere'],
      kind: region.kind as Region['kind'],
      display_color: region.display_color as Region['display_color'],
    }));
    const whole: Pick<Manifest, 'schema_version'> = {
      schema_version: manifest.schema_version as 1,
    };
    assert.equal(whole.schema_version, 1);
    assert.ok(regions.length);
  });
});
