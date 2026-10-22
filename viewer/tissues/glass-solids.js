import { DoubleSide, Group, Mesh, MeshPhysicalMaterial, SRGBColorSpace } from 'three';
import { isPhone } from '../render/device.js';

/**
 * The cortical ribbon behind each solid region of the glass brain.
 *
 * A region's own surface patch is opaque but has no thickness, so seen through
 * the glass from behind or edge-on it reads as a shell. The solid between its
 * pial and white surfaces closes it. It is pushed back in depth so that, on the
 * pial face they share, the patch and its fold shading are what show.
 */
export function createGlassSolids(wedges, appearance) {
  const { tissue } = appearance;
  const group = new Group();
  group.name = 'Glass-brain ribbon solids';
  group.visible = false;
  const meshes = wedges.map(source => {
    source.geometry.computeVertexNormals();
    const mesh = new Mesh(source.geometry, new MeshPhysicalMaterial({
      side: DoubleSide, roughness: tissue.roughness,
      clearcoat: isPhone() ? 0 : tissue.clearcoat,
      clearcoatRoughness: tissue.clearcoat_roughness,
      ior: tissue.ior, specularIntensity: tissue.specular_intensity,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
    mesh.userData = { ...source.userData };
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return mesh;
  });

  return {
    group,
    meshes,
    /** `solidOf(id)` is the region a parcel is drawn solid as, or null; `shown(id)` whether its patch is drawn. */
    update({ solidOf, shown, clippingPlanes }) {
      for (const mesh of meshes) {
        const id = mesh.userData.region_id;
        const record = solidOf(id);
        mesh.visible = Boolean(record) && shown(id);
        if (!mesh.visible) continue;
        mesh.material.color.setRGB(...record.color.map(value => value / 255), SRGBColorSpace);
        if (mesh.material.clippingPlanes !== clippingPlanes) {
          mesh.material.clippingPlanes = clippingPlanes;
          mesh.material.needsUpdate = true;
        }
      }
      group.visible = meshes.some(mesh => mesh.visible);
    },
  };
}
