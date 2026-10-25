import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import * as assetCache from '../../core/assets/asset-cache.ts';
import { BoxGeometry, Color, Matrix4, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { asDisplaySettings, readModel } from '../../core/catalog/test-support.ts';
import type { Appearance } from '../render/materials.ts';
import { Volume } from '../slices/volume.ts';
import type { PaletteLookup } from './palette.ts';
import {
  BANDS,
  addSolidSources,
  enclosingFirst,
  indexLabels,
  paintSolids,
} from './solid-assets.ts';
import type { PaintableSolid, SolidSourceAnatomy } from './solid-assets.ts';
import { SolidSections } from './solid-sections.ts';
import type { SolidSource } from './solid-sections.ts';
import { createWhiteMatter } from './white-matter.ts';

const { appearance } = readModel<{ appearance: Appearance }>('cdmd/manifest.json');

const PARCEL = 'destrieux:left:1';
const LABELS = indexLabels([
  {
    source_label_id: 2,
    name: 'Left-Cerebral-White-Matter',
    color: [245, 245, 245],
    hemisphere: 'left',
    kind: 'tissue',
    region_id: null,
  },
  {
    source_label_id: 11101,
    name: 'ctx_lh_G_and_S_frontomargin',
    color: [23, 220, 60],
    hemisphere: 'left',
    kind: 'cortex',
    region_id: PARCEL,
  },
  {
    source_label_id: 11,
    name: 'Left-Caudate',
    color: [122, 186, 220],
    hemisphere: 'left',
    kind: 'tissue',
    region_id: 'aseg:left:11',
  },
]);

const LOOKUP = {
  regions: new Map([[PARCEL, { networks: [{ network: 'Default', fraction: 0.7 }] }]]),
  networks: { colors: { Default: [205, 62, 78] } },
} as unknown as PaletteLookup;

const STATE = {
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  surfaceColor: 'tissue',
  isolatedRegion: null,
};

function solid(userData: Record<string, unknown>): PaintableSolid {
  const material = new MeshBasicMaterial();
  material.userData['tissueVariation'] = { value: 0 };
  material.userData['sampledLabels'] = { value: false };
  return { source: { userData }, cap: { material }, visible: true };
}

function paint(
  solids: PaintableSolid[],
  { detail = 'aseg', ...state }: Record<string, unknown> & { detail?: string } = {},
  wedged = true,
): PaintableSolid[] {
  paintSolids(
    { solids },
    {
      labels: LABELS,
      state: asDisplaySettings({ ...STATE, ...state }),
      atlas: 'destrieux',
      detail,
      wedged,
      appearance,
      lookup: LOOKUP,
    },
  );
  return solids;
}

const wedge = () =>
  solid({ hemisphere: 'left', atlas: 'destrieux', kind: 'ribbon', region_id: PARCEL });
const published = (r: number, g: number, b: number) =>
  new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);

test('the white envelope stays white matter where a parcel reuses its code', () => {
  const labels = indexLabels([
    {
      source_label_id: 2,
      name: 'Left-Cerebral-White-Matter',
      color: [245, 245, 245],
      hemisphere: 'left',
      kind: 'tissue',
      region_id: null,
    },
    {
      source_label_id: 2,
      name: 'R_MST_ROI',
      color: [20, 30, 200],
      hemisphere: 'right',
      kind: 'cortex',
      region_id: 'hcp-mmp:right:2',
    },
  ]);
  const white = solid({ hemisphere: 'left', boundary: 'white' });
  paintSolids(
    { solids: [white] },
    {
      labels,
      state: asDisplaySettings({ ...STATE, surfaceColor: 'atlas' }),
      atlas: 'hcp-mmp',
      detail: 'aseg',
      wedged: true,
      appearance,
      lookup: LOOKUP,
    },
  );
  assert.ok(white.cap.material.color.equals(published(245, 245, 245)));
});

test('a parcel solid takes the published atlas colour', () => {
  const [painted] = paint([wedge()], { surfaceColor: 'atlas' }) as [PaintableSolid];
  assert.ok(painted.visible);
  assert.ok(painted.cap.material.color.equals(published(23, 220, 60)));
});

test('a parcel solid takes its dominant network colour', () => {
  const [painted] = paint([wedge()], { surfaceColor: 'network' });
  assert.ok(
    painted.cap.material.color.equals(new Color().setRGB(205 / 255, 62 / 255, 78 / 255, 'srgb')),
  );
});

test('tissue colour ignores the parcellation entirely', () => {
  const [painted] = paint([wedge()], { surfaceColor: 'tissue' });
  assert.equal(painted.cap.material.color.getHexString(), appearance.tissue.cortex.slice(1));
});

test('a published palette drops the T1 modulation the tissue cut carries', () => {
  for (const [surfaceColor, expected] of [
    ['tissue', appearance.intensity.cut_strength],
    ['atlas', 0],
    ['network', 0],
  ]) {
    const [painted] = paint([wedge()], { surfaceColor });
    assert.equal(painted.cap.material.userData.tissueVariation.value, expected);
  }
});

test('a parcel the segmentation never labelled still gets the unlabelled colour', () => {
  const medial = solid({
    hemisphere: 'left',
    atlas: 'destrieux',
    kind: 'ribbon',
    region_id: 'destrieux:left:-1',
  });
  const [painted] = paint([medial], { surfaceColor: 'atlas' });
  assert.ok(painted.visible);
  assert.equal(painted.cap.material.color.getHexString(), appearance.tissue.unlabelled.slice(1));
});

test('hemisphere and cortex controls hide the solids they describe', () => {
  assert.equal(paint([wedge()], { hemisphere: 'right' })[0].visible, false);
  assert.equal(paint([wedge()], { cortexVisible: false })[0].visible, false);
  assert.equal(paint([wedge()], { cortexOpacity: 0 })[0].visible, false);
  assert.equal(paint([wedge()], { hemisphere: 'left' })[0].visible, true);
});

test('a removed parcel does not leave its solid cut cap on screen', () => {
  const [parcel] = paint([wedge()], { hiddenRegions: new Set([PARCEL]) });
  assert.equal(parcel.visible, false);
});

test('isolation leaves only the isolated parcel standing', () => {
  const caudate = solid({ hemisphere: 'left', region_id: 'aseg:left:11' });
  const [parcel, nucleus] = paint([wedge(), caudate], { isolatedRegion: PARCEL });
  assert.equal(parcel.visible, true);
  assert.equal(nucleus.visible, false);
});

test('the white envelope is painted by the white matter label, not a guess', () => {
  const white = solid({ hemisphere: 'left', boundary: 'white' });
  const [painted] = paint([white], { surfaceColor: 'atlas' });
  assert.ok(painted.cap.material.color.equals(published(245, 245, 245)));
});

test('the pial envelope stands in only where an atlas has no parcel solids', () => {
  const pial = () => solid({ hemisphere: 'left', boundary: 'pial' });
  assert.equal(paint([pial()], {}, true)[0].visible, false);
  const [standIn] = paint([pial()], {}, false);
  assert.equal(standIn.visible, true);
  assert.equal(standIn.cap.material.color.getHexString(), appearance.tissue.cortex.slice(1));
});

test('another atlas’s parcel solids stay out of this cut', () => {
  const other = solid({
    hemisphere: 'left',
    atlas: 'hcp-mmp',
    kind: 'ribbon',
    region_id: 'hcp-mmp:left:1',
  });
  assert.equal(paint([other], { surfaceColor: 'atlas' })[0].visible, false);
});

test('the cut caps the detail level the viewer is showing, and only that one', () => {
  const nucleus = (level: string) =>
    solid({ hemisphere: 'left', region_id: 'aseg:left:11', detail: level });
  const [shown] = paint([nucleus('aseg')], { detail: 'aseg' });
  assert.equal(shown.visible, true);
  const [hidden] = paint([nucleus('aseg')], { detail: 'nextbrain' });
  assert.equal(hidden.visible, false);
});

test('a nucleus the cut atlas never labelled keeps its own published colour', () => {
  const nucleus = () => {
    const entry = solid({ hemisphere: 'left', region_id: 'nextbrain:left:7', detail: 'nextbrain' });
    entry.source.material = { color: published(60, 180, 90) };
    return entry;
  };
  const [atlas] = paint([nucleus()], { detail: 'nextbrain', surfaceColor: 'atlas' });
  assert.ok(atlas.cap.material.color.equals(published(60, 180, 90)));
  const [tissue] = paint([nucleus()], { detail: 'nextbrain', surfaceColor: 'tissue' });
  assert.equal(tissue.cap.material.color.getHexString(), appearance.tissue.gray.slice(1));
  // In no network, so a network palette leaves it in tissue colour as its surface is.
  for (const surfaceColor of ['network', 'cab-np']) {
    const [networked] = paint([nucleus()], { detail: 'nextbrain', surfaceColor });
    assert.equal(networked.cap.material.color.getHexString(), appearance.tissue.gray.slice(1));
  }
});

test('under a paint, a nucleus the cut atlas never labelled takes its paint colour, or tissue colour', () => {
  const nucleus = (id: string) => {
    const entry = solid({ hemisphere: 'left', region_id: id, detail: 'nextbrain' });
    entry.source.material = { color: published(60, 180, 90) };
    return entry;
  };
  const state = {
    detail: 'nextbrain',
    surfaceColor: 'atlas',
    paint: { id: 'deficit:amnesia', colors: new Map([['nextbrain:left:7', [0, 0, 255]]]) },
  };
  const [painted, other] = paint([nucleus('nextbrain:left:7'), nucleus('nextbrain:left:8')], state);
  assert.ok(painted.cap.material.color.equals(published(0, 0, 255)));
  assert.equal(other.cap.material.color.getHexString(), appearance.tissue.gray.slice(1));
});

test('a painted solid answers for the region its colour came from', () => {
  const white = solid({ hemisphere: 'left', boundary: 'white' });
  const [parcel, envelope] = paint([wedge(), white]);
  assert.equal(parcel.region, PARCEL);
  // The white matter label carries no region, so neither does its envelope:
  // nothing can point at it, so nothing may light it.
  assert.equal(envelope.region, null);
});

test('a wedge the cut atlas never labelled answers for no region', () => {
  const medial = solid({
    hemisphere: 'left',
    atlas: 'destrieux',
    kind: 'ribbon',
    region_id: 'destrieux:left:99',
  });
  assert.equal(paint([medial])[0].region, null);
});

test('a nucleus the cut atlas never labelled still answers for itself', () => {
  const nucleus = solid({ hemisphere: 'left', detail: 'aseg', region_id: 'aseg:left:17' });
  assert.equal(paint([nucleus])[0].region, 'aseg:left:17');
});

const WHITE_MATTER_PARCEL = 'wmparc:left:3024';

function whiteMatter() {
  const record = {
    shape: [1, 1, 1],
    order: 'F',
    applies_to: ['destrieux'],
    voxel_to_surface_ras_mm: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
    labels: [
      { source_label_id: 0, region_id: null },
      { source_label_id: 3024, region_id: WHITE_MATTER_PARCEL },
    ],
  };
  return createWhiteMatter(record, new Volume(record, new Uint8Array([1])));
}

test('isolating a white-matter parcel keeps its own hemisphere’s white envelope standing', () => {
  const lookup = {
    ...LOOKUP,
    regions: new Map([[WHITE_MATTER_PARCEL, { hemisphere: 'left' }]]),
  } as unknown as PaletteLookup;
  const left = solid({ hemisphere: 'left', boundary: 'white' });
  const right = solid({ hemisphere: 'right', boundary: 'white' });
  paintSolids(
    { solids: [left, right] },
    {
      labels: LABELS,
      state: asDisplaySettings({ ...STATE, isolatedRegion: WHITE_MATTER_PARCEL }),
      atlas: 'destrieux',
      detail: 'aseg',
      wedged: true,
      appearance,
      lookup,
      whiteMatter: whiteMatter(),
    },
  );
  assert.equal(left.visible, true);
  assert.equal(right.visible, false);
});

test('only the white envelope cap samples gyral white matter', () => {
  const solids = new SolidSections();
  const envelope = (boundary: string): SolidSource => {
    const mesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1));
    mesh.userData = { hemisphere: 'left', boundary };
    return mesh;
  };
  const anatomy = {
    texture: null,
    worldToVoxel: new Matrix4(),
    volume: { shape: [1, 1, 1] },
    capLabels: {},
    mriUniforms: {},
  } as unknown as SolidSourceAnatomy;
  addSolidSources(
    solids,
    [envelope('pial'), envelope('white')],
    anatomy,
    appearance,
    BANDS.envelope,
    whiteMatter(),
  );
  const [pial, white] = solids.solids.map(({ cap }) => {
    const shader = {
      uniforms: {} as Record<string, { value: { isData3DTexture: boolean } }>,
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>',
    };
    cap.material.onBeforeCompile(shader as never, undefined as never);
    return shader.uniforms;
  });
  assert.equal(pial!['whiteMatterVolume'], undefined);
  assert.equal(white!['whiteMatterVolume']!.value.isData3DTexture, true);
  solids.dispose();
});

test('learning caps obey system filtering and remain visible during isolation', () => {
  const id = 'learning:left:caudate';
  const record = {
    id,
    atlas: 'learning',
    kind: 'structure',
    hemisphere: 'left',
    source_name: 'Caudate',
    display_names: { en: 'Caudate' },
    system_names: { en: 'Basal ganglia' },
  };
  const cap = solid({ ...record, region_id: id, detail: 'learning' });
  const options = {
    labels: LABELS,
    atlas: 'destrieux',
    detail: 'learning',
    wedged: true,
    appearance,
    lookup: { regions: new Map([[id, record]]) } as unknown as PaletteLookup,
  };
  paintSolids(
    { solids: [cap] },
    {
      ...options,
      state: asDisplaySettings({ ...STATE, detail: 'learning', internalSystem: 'Brainstem' }),
    },
  );
  assert.equal(cap.visible, false);
  paintSolids(
    { solids: [cap] },
    {
      ...options,
      state: asDisplaySettings({
        ...STATE,
        detail: 'learning',
        internalSystem: 'Basal ganglia',
        isolatedRegion: id,
      }),
    },
  );
  assert.equal(cap.visible, true);
  assert.equal(cap.region, id);
});

test('a reference cord cap is painted as the tissue its region declares, not by its name', () => {
  const cap = (id: string, source_name: string, tissue: string) =>
    solid({
      hemisphere: 'left',
      supplemental: true,
      mri_registered: false,
      region_id: `zanatomy:left:${id}`,
      source_name,
      tissue,
    });
  const [tract, nucleus, canal] = paint([
    cap('lateral-corticospinal-tract', 'Lateral corticospinal tract', 'white'),
    cap('nucleus-proprius', 'Nucleus proprius', 'gray'),
    cap('central-canal', 'Central canal', 'fluid'),
  ]);
  assert.equal(tract.cap.material.color.getHexString(), appearance.tissue.white.slice(1));
  assert.equal(nucleus.cap.material.color.getHexString(), appearance.tissue.gray.slice(1));
  assert.equal(canal.cap.material.color.getHexString(), appearance.tissue.fluid.slice(1));
});

test('nested reference solids reach the cut after the solids that enclose them', () => {
  const source = (id: string, volume: number) => ({
    userData: { region_id: id, segmentation_volume_mm3: volume },
  });
  const sources = [
    source('nucleus proprius', 73),
    source('cord', 45710),
    source('posterior horn', 1180),
  ];
  assert.deepEqual(
    enclosingFirst(sources).map((entry) => entry.userData.region_id),
    ['cord', 'posterior horn', 'nucleus proprius'],
  );
});

test('a hidden id missing from the region index is a named error', async () => {
  const state = asDisplaySettings({
    cortexVisible: true,
    cortexOpacity: 1,
    isolatedRegion: null,
    hiddenRegions: new Set(['nope']),
    atlas: 'destrieux',
    hemisphere: 'both',
  });
  const { exposedWhiteMatter } = await import('./white-matter-surfaces.ts');
  assert.throws(
    () => exposedWhiteMatter(state, new Map()),
    /Hidden region nope is not in the region index/,
  );
});

test('a ribbon label file of the wrong length is refused', async () => {
  const { loadRibbonSources } = await import('./solid-assets.ts');
  const manifest = {
    atlases: [
      {
        id: 'a',
        ribbon_labels: {
          file: 'x.labels',
          vertex_counts: { left: 2, right: 2 },
          region_ids: [],
        },
      },
    ],
  } as never;
  vi.spyOn(assetCache, 'fetchAsset').mockResolvedValue(new ArrayBuffer(6));
  await assert.rejects(
    loadRibbonSources(manifest, 'http://x/', 'a', []),
    /hold 6 bytes; the manifest publishes 8/,
  );
});
