import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

/** Display colours describe tissue classes, never a measured tissue albedo. */
export function tissueColor(region, palette) {
  if (region.tissue && palette[region.tissue]) return palette[region.tissue];
  if (region.kind === 'non-region') return palette.unlabelled;
  if (region.kind === 'cortex') return palette.cortex;
  const name = region.source_name;
  if (/(?:^|[-_\s])(?:ventricles?|vent|CSF)(?:$|[-_\s])/i.test(name)) return palette.fluid;
  if (/white|^CC_|callosum/i.test(name)) return palette.white;
  return palette.gray;
}

/**
 * Source morphometry modulates illumination, independently of atlas colour.
 *
 * `withNetworks` is all-or-nothing across a build — either the network layer
 * was built and every cortical mesh carries it, or none does — so this adds at
 * most one program variant rather than one per mesh.
 */
function addFoldShading(material, { folds, intensity }, withNetworks) {
  const variation = { value: intensity.surface_strength };
  const networkMix = { value: 0 };
  material.userData.tissueVariation = variation;
  material.userData.networkMix = withNetworks ? networkMix : null;
  material.onBeforeCompile = shader => {
    shader.uniforms.tissueVariation = variation;
    if (withNetworks) shader.uniforms.networkMix = networkMix;
    shader.uniforms.t1Range = { value: [intensity.low, intensity.high] };
    shader.uniforms.concavityRange = { value: [folds.concavity_low, folds.concavity_high] };
    shader.uniforms.foldRange = { value: [folds.low, folds.high] };
    shader.uniforms.foldStrength = {
      value: [folds.direct_strength, folds.indirect_strength],
    };
    shader.vertexShader = `attribute float _sulc;
attribute float _concavity;
attribute float _t1;
varying float vConcavity;
varying float vT1;
varying float vSulcalDepth;
${withNetworks ? 'attribute vec4 _networkColor;\nvarying vec4 vNetworkColor;' : ''}
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vSulcalDepth = _sulc;
vConcavity = _concavity;
vT1 = _t1;
${withNetworks ? 'vNetworkColor = _networkColor;' : ''}`,
    );
    shader.fragmentShader = `varying float vSulcalDepth;
varying float vConcavity;
varying float vT1;
uniform vec2 concavityRange;
uniform vec2 t1Range;
uniform float tissueVariation;
uniform vec2 foldRange;
uniform vec2 foldStrength;
${withNetworks ? 'varying vec4 vNetworkColor;\nuniform float networkMix;' : ''}
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      ${withNetworks ? `
      // The fourth channel is zero off the networked surface, so the medial
      // wall keeps its region colour however far this is turned up.
      diffuseColor.rgb = mix(
        diffuseColor.rgb, vNetworkColor.rgb, networkMix * vNetworkColor.a);` : ''}
      float intensity = clamp((vT1 - t1Range.x) / (t1Range.y - t1Range.x), 0.0, 1.0);
      diffuseColor.rgb *= 1.0 + tissueVariation * (2.0 * intensity - 1.0);`,
    ).replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      float depth = smoothstep(foldRange.x, foldRange.y, vSulcalDepth);
      float bank = smoothstep(concavityRange.x, concavityRange.y, vConcavity);
      float fold = mix(bank, depth, 0.25);
      reflectedLight.directDiffuse *= 1.0 - foldStrength.x * fold;
      reflectedLight.indirectDiffuse *= 1.0 - foldStrength.y * fold;
      reflectedLight.indirectSpecular *= 1.0 - foldStrength.y * fold;`,
    );
  };
  material.customProgramCacheKey = () =>
    `source-tissue-relief-v3${withNetworks ? '-network' : ''}`;
}

export function createAnatomicalMaterial(mesh, region, appearance) {
  const material = new MeshPhysicalMaterial();
  MeshStandardMaterial.prototype.copy.call(material, mesh.material);
  material.roughness = appearance.tissue.roughness;
  material.clearcoat = appearance.tissue.clearcoat;
  material.clearcoatRoughness = appearance.tissue.clearcoat_roughness;
  material.ior = appearance.tissue.ior;
  material.specularIntensity = appearance.tissue.specular_intensity;
  const cortical = region.kind === 'cortex' || region.kind === 'non-region';
  if (cortical) {
    for (const name of ['_sulc', '_concavity', '_t1']) {
      const attribute = mesh.geometry.getAttribute(name);
      if (!attribute || attribute.itemSize !== 1 ||
          attribute.count !== mesh.geometry.attributes.position.count) {
        material.dispose();
        throw new Error(`Missing source shading attribute ${name}: ${region.id}`);
      }
    }
    addFoldShading(material, appearance, Boolean(mesh.geometry.getAttribute('_network')));
  }
  return material;
}
