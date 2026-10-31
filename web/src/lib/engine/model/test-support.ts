import { readFile } from 'node:fs/promises';
import {
  BoxGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readRepoYaml } from '../../../../test/repo.ts';
import { readModel } from '../../core/catalog/test-support.ts';
import { BrainAtlas } from './brain-atlas.ts';
import type { AtlasManifest, GlbLoader } from './brain-atlas.ts';

/** A published anatomy's directory under `public/models/`. */
export const modelDirectory = (id: string) =>
  new URL(`../../../../../public/models/${id}/`, import.meta.url);

/** The manifest an anatomy publishes, as the model reads it. */
export const readManifest = (id: string) => readModel<AtlasManifest>(`${id}/manifest.json`);

/** Parse each GLB from the published directory rather than over the network. */
export function publishedLoader(directory: URL, onLoad?: (file: string) => void): GlbLoader {
  const gltf = new GLTFLoader();
  return {
    async loadAsync(file) {
      onLoad?.(file);
      const bytes = await readFile(new URL(file, directory));
      return gltf.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        '',
      );
    },
  };
}

/* oxlint-disable typescript/no-explicit-any -- fixtures stand in for published JSON */
const syntheticRegions = [
  {
    id: 'a-left',
    label: 'A left',
    hemisphere: 'left',
    atlas: 'a',
    source_label_id: 1,
    kind: 'cortex',
  },
  {
    id: 'a-right',
    label: 'A right',
    hemisphere: 'right',
    atlas: 'a',
    source_label_id: 2,
    kind: 'cortex',
  },
  {
    id: 'a-wall',
    label: 'Unlabeled',
    hemisphere: 'left',
    atlas: 'a',
    source_label_id: 0,
    source_name: 'Unknown',
    kind: 'non-region',
  },
  {
    id: 'b-left',
    label: 'B left',
    hemisphere: 'left',
    atlas: 'b',
    source_label_id: 1,
    kind: 'cortex',
  },
  {
    id: 'stem',
    label: 'Brainstem',
    hemisphere: 'midline',
    atlas: 'aseg',
    source_label_id: 16,
    kind: 'structure',
  },
  {
    id: 'n-left',
    label: 'N left',
    hemisphere: 'left',
    atlas: 'n',
    source_label_id: 48,
    kind: 'tissue-region',
  },
];

const syntheticCabNp = {
  id: 'cab-np',
  atlas: 'a',
  networks: ['Visual1', 'Default'],
  colors: { Visual1: [0, 0, 255], Default: [255, 0, 0] },
  regions: { 'a-left': 'Default', 'a-right': 'Visual1' },
};

const syntheticFunctional = {
  id: 'functional-regions',
  atlas: 'a',
  sources: { glasser: { citation: 'Glasser et al. (2016)' } },
  levels: {
    named: [
      {
        id: 'm1',
        name: 'M1',
        name_fr: 'M1',
        short: 'M1',
        short_fr: 'M1',
        source: 'glasser',
        color: [255, 0, 0],
        areas: ['4'],
      },
    ],
    sections: [
      {
        id: 'section-6',
        number: 6,
        name: 'S6',
        name_fr: 'S6',
        short: 'S6',
        short_fr: 'S6',
        source: 'glasser',
        color: [0, 0, 255],
        areas: ['4'],
      },
      {
        id: 'section-22',
        number: 22,
        name: 'S22',
        name_fr: 'S22',
        short: 'S22',
        short_fr: 'S22',
        source: 'glasser',
        color: [0, 255, 0],
        areas: ['46'],
      },
    ],
  },
  regions: {
    named: { 'a-left': 'm1' },
    sections: { 'a-left': 'section-6', 'a-right': 'section-22' },
  },
};

/** The synthetic loader: atlas `a` (left, right, medial wall), atlas `b`, the `aseg` structure and two envelopes. */
function syntheticLoader(): GlbLoader {
  return {
    async loadAsync(file, onProgress) {
      onProgress?.({ loaded: 10, total: 20 } as never);
      onProgress?.({ loaded: 20, total: 20 } as never);
      const scene = new Group();
      if (file === 'tissue-envelopes.glb') {
        for (const [index, hemisphere] of ['left', 'right'].entries()) {
          const mesh = new Mesh(new BoxGeometry(0.009, 0.009, 0.009), new MeshStandardMaterial());
          mesh.position.set(index * 0.03, 0, 0.015);
          mesh.userData = { hemisphere, boundary: 'white', units: 'meters' };
          scene.add(mesh);
        }
        return { scene } as never;
      }
      const atlasId = file === 'structures.glb' ? 'aseg' : file[0];
      for (const [index, region] of syntheticRegions.filter((r) => r.atlas === atlasId).entries()) {
        const mesh = new Mesh(
          new BoxGeometry(0.01, 0.01, 0.01),
          new MeshStandardMaterial({ side: DoubleSide }),
        );
        for (const name of ['_sulc', '_openness', '_t1']) {
          mesh.geometry.setAttribute(
            name,
            new Float32BufferAttribute(
              new Float32Array(mesh.geometry.attributes['position']!.count),
              1,
            ),
          );
        }
        mesh.position.x = index * 0.03;
        mesh.userData = { ...region, region_id: region.id };
        scene.add(mesh);
      }
      return { scene } as never;
    },
  };
}

/**
 * The small model the unit tests share: boxes 1 cm wide, 3 cm apart on x, with a CAB-NP partition and
 * functional divisions on atlas `a`. Not initialized.
 */
export function syntheticAtlas(): BrainAtlas {
  const { appearance } = readRepoYaml<{ appearance: unknown }>('config/model.yaml');
  const manifest = {
    schema_version: 1,
    appearance,
    anatomy: { id: 'bert', subject: 'bert', display_name: 'Subject', individual: true },
    atlases: [
      { id: 'a', label: 'Atlas A', file: 'a.glb' },
      { id: 'b', label: 'Atlas B', file: 'b.glb' },
    ],
    detail_levels: [{ id: 'aseg', label: 'Coarse', file: 'structures.glb' }],
    solid_envelopes: { file: 'tissue-envelopes.glb' },
    regions: syntheticRegions.map((region) => ({ ...region })),
  } as unknown as AtlasManifest;
  return new BrainAtlas(
    manifest,
    syntheticLoader(),
    structuredClone(syntheticCabNp) as never,
    structuredClone(syntheticFunctional) as never,
  );
}
