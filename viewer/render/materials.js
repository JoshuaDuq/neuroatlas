import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

/** Display colours describe tissue classes, never a measured tissue albedo. */
export function tissueColor(region, palette) {
  if (region.kind === 'non-region') return palette.unlabelled;
  if (region.kind === 'cortex') return palette.cortex;
  const name = region.source_name;
  if (/ventric|(?:^|-)vent$|\bCSF\b/i.test(name)) return palette.fluid;
  if (/white|^CC_|callosum/i.test(name)) return palette.white;
  return palette.gray;
}

/** Source morphometry modulates illumination, independently of atlas colour. */
function addFoldShading(material, folds) {
  material.onBeforeCompile = shader => {
    shader.uniforms.foldRange = { value: [folds.low, folds.high] };
    shader.uniforms.foldStrength = {
      value: [folds.direct_strength, folds.indirect_strength],
    };
    shader.vertexShader = `attribute float _sulc;
varying float vSulcalDepth;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSulcalDepth = _sulc;',
    );
    shader.fragmentShader = `varying float vSulcalDepth;
uniform vec2 foldRange;
uniform vec2 foldStrength;
${shader.fragmentShader}`.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      float fold = smoothstep(foldRange.x, foldRange.y, vSulcalDepth);
      reflectedLight.directDiffuse *= 1.0 - foldStrength.x * fold;
      reflectedLight.indirectDiffuse *= 1.0 - foldStrength.y * fold;`,
    );
  };
  material.customProgramCacheKey = () => 'source-sulcal-relief-v1';
}

export function createAnatomicalMaterial(mesh, region, appearance) {
  const material = new MeshPhysicalMaterial();
  MeshStandardMaterial.prototype.copy.call(material, mesh.material);
  material.roughness = appearance.tissue.roughness;
  material.clearcoat = appearance.tissue.clearcoat;
  material.clearcoatRoughness = appearance.tissue.clearcoat_roughness;
  const cortical = region.kind === 'cortex' || region.kind === 'non-region';
  if (cortical) {
    const sulcalDepth = mesh.geometry.getAttribute('_sulc');
    if (!sulcalDepth || sulcalDepth.itemSize !== 1 ||
        sulcalDepth.count !== mesh.geometry.attributes.position.count) {
      material.dispose();
      throw new Error(`Missing source sulcal-depth attribute: ${region.id}`);
    }
    addFoldShading(material, appearance.folds);
  }
  return material;
}
