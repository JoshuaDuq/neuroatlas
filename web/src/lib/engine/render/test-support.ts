import {
  BufferGeometry,
  DoubleSide,
  Data3DTexture,
  DataTexture,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RedFormat,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { appearance as published } from '../../../../../public/models/cdmd/manifest.json';
import type { Region } from '../../types/index.ts';
import { Volume } from '../slices/volume.ts';
import { addCapLabels, createCapLabels } from '../tissues/cap-labels.ts';
import { createCutMaterial } from '../tissues/shader.ts';
import { createSolidMaterial } from '../tissues/solid-material.ts';
import { createWhiteMatter } from '../tissues/white-matter.ts';
import { addBorderFeather } from './border-feather.ts';
import { isPhone } from './device.ts';
import { createAnatomicalMaterial } from './materials.ts';
import type { Appearance } from './materials.ts';
import { addMriAppearance, createMriUniforms } from './mri-material.ts';

/** The published appearance of the CDMD anatomy. Imported, not read from disk, so browser tests can use it. */
export const appearance = published as unknown as Appearance;

/** A cortical mesh with the shading fields (and, if asked, the network layer) the model checks for. */
export function corticalMesh(withNetworks: boolean, count = 5) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
  for (const name of ['_sulc', '_concavity', '_t1']) {
    geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(count).fill(0.5), 1));
  }
  if (withNetworks) {
    geometry.setAttribute(
      '_network',
      new Float32BufferAttribute(new Float32Array(count).fill(1), 1),
    );
    geometry.setAttribute(
      '_networkColor',
      new Float32BufferAttribute(new Float32Array(count * 4).fill(1), 4),
    );
  }
  return new Mesh(
    geometry,
    new MeshStandardMaterial({ color: '#336699', roughness: 0.3, side: DoubleSide }),
  );
}

/**
 * One material for each distinct set of patches the app builds (decision 25 on #4), by name: the
 * anatomical surface with and without the network layer, alone, feathered, with the MRI and with
 * both in either order; a plain material with the MRI; the cut material alone and with the MRI
 * (mark `lift`); the solid material with and without white matter, alone, with the MRI (mark
 * `capLift`) and with cap labels as well.
 */
export function patchCombinations(): Map<string, Material> {
  const combinations = new Map<string, Material>();
  const anatomy = {
    texture: Object.assign(new Data3DTexture(new Uint8Array(8), 2, 2, 2), {
      format: RedFormat,
      type: UnsignedByteType,
    }),
    worldToVoxel: new Matrix4().makeTranslation(1, 2, 3),
    volume: { shape: [2, 2, 2] as [number, number, number] },
  };
  const feather = () => new DataTexture(new Float32Array(8), 2, 1);
  const add = (name: string, build: () => Material) => combinations.set(name, build());
  const surface = (withNetworks: boolean) =>
    createAnatomicalMaterial(
      corticalMesh(withNetworks) as never,
      { id: 'r', kind: 'cortex' } as Region,
      appearance,
    );

  for (const withNetworks of [false, true]) {
    const label = withNetworks ? 'networked surface' : 'plain surface';
    add(label, () => surface(withNetworks));
    add(`${label} + feather`, () => {
      const material = surface(withNetworks);
      addBorderFeather(material, feather());
      return material;
    });
    add(`${label} + MRI`, () => {
      const material = surface(withNetworks);
      addMriAppearance(material, createMriUniforms(anatomy));
      return material;
    });
    // The model adds the MRI first when the scan is already attached, the feather first when it is attached later.
    add(`${label} + MRI + feather`, () => {
      const material = surface(withNetworks);
      addMriAppearance(material, createMriUniforms(anatomy));
      addBorderFeather(material, feather());
      return material;
    });
    add(`${label} + feather + MRI`, () => {
      const material = surface(withNetworks);
      addBorderFeather(material, feather());
      addMriAppearance(material, createMriUniforms(anatomy));
      return material;
    });
  }

  add('plain material + MRI', () => {
    // The exposed white matter: double-sided, with the coat unless on a phone.
    const material = new MeshPhysicalMaterial({
      color: '#abcdef',
      side: DoubleSide,
      clearcoat: isPhone() ? 0 : appearance.tissue.clearcoat,
    });
    addMriAppearance(material, createMriUniforms(anatomy));
    return material;
  });

  const cutUniforms = () => ({
    labelVolume: { value: null },
    labelPalette: { value: null },
    worldToVoxel: { value: new Matrix4() },
    volumeShape: { value: new Vector3(2, 2, 2) },
    highlightCodes: { value: new Vector2(-1, -1) },
    highlightLifts: { value: new Vector2() },
  });
  add('cut material', () => createCutMaterial(cutUniforms(), appearance.tissue));
  add('cut material + MRI', () => {
    const material = createCutMaterial(cutUniforms(), appearance.tissue);
    addMriAppearance(material, createMriUniforms(anatomy), 'lift');
    return material;
  });

  const record = {
    shape: [3, 2, 2],
    order: 'F',
    voxel_to_surface_ras_mm: [
      [-1, 0, 0, 10],
      [0, 0, 1, 0],
      [0, -1, 0, 0],
      [0, 0, 0, 1],
    ],
    applies_to: ['destrieux', 'hcp-mmp'],
    labels: [
      { source_label_id: 0, region_id: null },
      { source_label_id: 3024, region_id: 'wmparc:left:3024' },
    ],
  };
  const whiteMatter = () =>
    createWhiteMatter(record as never, new Volume(record as never, new Uint8Array(12)));
  for (const withWhiteMatter of [false, true]) {
    const label = withWhiteMatter ? 'solid with white matter' : 'solid';
    const solid = () =>
      createSolidMaterial(anatomy, appearance, withWhiteMatter ? whiteMatter() : null);
    add(label, solid);
    add(`${label} + MRI`, () => {
      const material = solid();
      addMriAppearance(material, createMriUniforms(anatomy), 'capLift');
      return material;
    });
    add(`${label} + cap labels + MRI`, () => {
      const material = solid();
      addCapLabels(material, createCapLabels());
      addMriAppearance(material, createMriUniforms(anatomy), 'capLift');
      return material;
    });
  }
  return combinations;
}
