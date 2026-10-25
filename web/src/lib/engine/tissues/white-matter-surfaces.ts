import { DoubleSide, MeshPhysicalMaterial } from 'three';
import type { Mesh, Object3D, Plane } from 'three';
import type { DisplaySettings, Region } from '../../types/index.ts';
import { isPhone } from '../render/device.ts';
import type { Appearance } from '../render/materials.ts';

type ExposureState = Pick<
  DisplaySettings,
  'cortexVisible' | 'cortexOpacity' | 'isolatedRegion' | 'hiddenRegions' | 'atlas' | 'hemisphere'
>;

export type WhiteMatterMesh = Mesh<Mesh['geometry'], MeshPhysicalMaterial>;

export interface WhiteMatterSurfaces {
  group: Object3D;
  meshes: WhiteMatterMesh[];
  update(
    state: ExposureState,
    regions: ReadonlyMap<string, Region>,
    clippingPlanes: Plane[] | null,
  ): void;
}

/** The hemispheres whose white surface hidden cortex of the shown atlas lays open, as displayed now. */
export function exposedWhiteMatter(
  state: ExposureState,
  regions: ReadonlyMap<string, Region>,
): Set<string> {
  const exposed = new Set<string>();
  if (!state.cortexVisible || !(state.cortexOpacity > 0) || state.isolatedRegion) return exposed;
  for (const id of state.hiddenRegions) {
    const region = regions.get(id)!;
    if (
      region.kind === 'cortex' &&
      region.atlas === state.atlas &&
      (state.hemisphere === 'both' || state.hemisphere === region.hemisphere)
    ) {
      exposed.add(region.hemisphere);
    }
  }
  return exposed;
}

/** Native grey/white boundaries exposed by selectively hiding cortical parcels. */
export function createWhiteMatterSurfaces(
  group: Object3D,
  appearance: Pick<Appearance, 'tissue'>,
): WhiteMatterSurfaces {
  const meshes: WhiteMatterMesh[] = [];
  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = false;
    if (mesh.userData['boundary'] === 'white') meshes.push(mesh as WhiteMatterMesh);
  });
  for (const hemisphere of ['left', 'right']) {
    if (meshes.filter((mesh) => mesh.userData['hemisphere'] === hemisphere).length !== 1) {
      throw new Error(`Expected one native ${hemisphere} white-matter surface.`);
    }
  }
  const { tissue } = appearance;
  for (const mesh of meshes) {
    (mesh.material as MeshPhysicalMaterial).dispose();
    mesh.material = new MeshPhysicalMaterial({
      color: tissue.white,
      side: DoubleSide,
      roughness: tissue.roughness,
      clearcoat: isPhone() ? 0 : tissue.clearcoat,
      clearcoatRoughness: tissue.clearcoat_roughness,
      ior: tissue.ior,
      specularIntensity: tissue.specular_intensity,
    });
    mesh.userData['kind'] = 'non-region';
  }
  group.name = 'Native exposed white matter';
  group.visible = false;

  return {
    group,
    meshes,
    update(state, regions, clippingPlanes) {
      const exposed = exposedWhiteMatter(state, regions);
      for (const mesh of meshes) {
        mesh.visible = exposed.has(mesh.userData['hemisphere'] as string);
        const material = mesh.material;
        const transparent = state.cortexOpacity < 1;
        if (material.transparent !== transparent || material.clippingPlanes !== clippingPlanes) {
          material.needsUpdate = true;
        }
        material.opacity = state.cortexOpacity;
        material.transparent = transparent;
        material.depthWrite = !transparent;
        material.clippingPlanes = clippingPlanes;
      }
      group.visible = meshes.some((mesh) => mesh.visible);
    },
  };
}
