import assert from 'node:assert/strict';
import { it } from 'vitest';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type {
  Manifest,
  ManifestAnatomy,
  ManifestAppearance,
  ManifestAtlas,
  ManifestCutAtlas,
  ManifestDetailLevel,
  ManifestSupplementalLayer,
  Region,
} from './index.ts';

/**
 * The published manifest, assigned to the types: `npm run check` fails here when a type
 * stops describing the data. JSON widens the literal unions, so `regions` is checked at
 * run time and then narrowed.
 */
it('CAT-06: the cdmd manifest fits the Manifest sections', () => {
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
