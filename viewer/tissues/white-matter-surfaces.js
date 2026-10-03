import { DoubleSide, MeshPhysicalMaterial } from 'three';
import { isPhone } from '../render/device.js';

/** Native grey/white boundaries exposed by selectively hiding cortical parcels. */
export function createWhiteMatterSurfaces(group, appearance) {
  const meshes = [];
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.visible = false;
    if (mesh.userData.boundary === 'white') meshes.push(mesh);
  });
  for (const hemisphere of ['left', 'right']) {
    if (meshes.filter(mesh => mesh.userData.hemisphere === hemisphere).length !== 1) {
      throw new Error(`Expected one native ${hemisphere} white-matter surface.`);
    }
  }
  const { tissue } = appearance;
  for (const mesh of meshes) {
    mesh.material.dispose();
    mesh.material = new MeshPhysicalMaterial({
      color: tissue.white, side: DoubleSide, roughness: tissue.roughness,
      clearcoat: isPhone() ? 0 : tissue.clearcoat,
      clearcoatRoughness: tissue.clearcoat_roughness,
      ior: tissue.ior, specularIntensity: tissue.specular_intensity,
    });
    mesh.userData.kind = 'non-region';
  }
  group.name = 'Native exposed white matter';
  group.visible = false;

  return {
    group,
    meshes,
    update(state, regions, clippingPlanes) {
      const exposed = new Set();
      for (const id of state.hiddenRegions) {
        const region = regions.get(id);
        if (region.kind === 'cortex' && region.atlas === state.atlas) {
          exposed.add(region.hemisphere);
        }
      }
      for (const mesh of meshes) {
        const hemisphere = mesh.userData.hemisphere;
        mesh.visible = exposed.has(hemisphere) && state.cortexVisible &&
          state.cortexOpacity > 0 && !state.isolatedRegion &&
          (state.hemisphere === 'both' || state.hemisphere === hemisphere);
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
      group.visible = meshes.some(mesh => mesh.visible);
    },
  };
}
