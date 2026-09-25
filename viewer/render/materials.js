import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { isPhone } from './device.js';

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
 * How to read one shading field back to its source units.
 *
 * The published files store these fields as normalized unsigned integers over
 * a span the build measured and the manifest carries, so the attribute arrives
 * in 0..1 rather than in millimetres of sulcal depth. A file written before
 * that encoding carries no span and is read straight through.
 */
function fieldDecode(ranges, name) {
  const span = ranges?.[name];
  return span ? [span[0], span[1] - span[0]] : [0, 1];
}

/**
 * Source morphometry modulates illumination, independently of atlas colour.
 *
 * `withNetworks` is all-or-nothing across a build — either the network layer
 * was built and every cortical mesh carries it, or none does — so this adds at
 * most one program variant rather than one per mesh.
 */
function addFoldShading(material, { folds, intensity, field_ranges: ranges }, withNetworks) {
  const variation = { value: intensity.surface_strength };
  const networkMix = { value: 0 };
  material.userData.tissueVariation = variation;
  material.userData.networkMix = withNetworks ? networkMix : null;
  material.onBeforeCompile = shader => {
    shader.uniforms.tissueVariation = variation;
    if (withNetworks) shader.uniforms.networkMix = networkMix;
    shader.uniforms.sulcDecode = { value: fieldDecode(ranges, '_SULC') };
    shader.uniforms.concavityDecode = { value: fieldDecode(ranges, '_CONCAVITY') };
    shader.uniforms.t1Decode = { value: fieldDecode(ranges, '_T1') };
    shader.uniforms.t1Range = { value: [intensity.low, intensity.high] };
    shader.uniforms.concavityRange = { value: [folds.concavity_low, folds.concavity_high] };
    shader.uniforms.foldRange = { value: [folds.low, folds.high] };
    shader.uniforms.foldStrength = {
      value: [folds.direct_strength, folds.indirect_strength],
    };
    shader.vertexShader = `attribute float _sulc;
attribute float _concavity;
attribute float _t1;
uniform vec2 sulcDecode;
uniform vec2 concavityDecode;
uniform vec2 t1Decode;
varying float vConcavity;
varying float vT1;
varying float vSulcalDepth;
${withNetworks ? 'attribute vec4 _networkColor;\nvarying vec4 vNetworkColor;' : ''}
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vSulcalDepth = _sulc * sulcDecode.y + sulcDecode.x;
vConcavity = _concavity * concavityDecode.y + concavityDecode.x;
vT1 = _t1 * t1Decode.y + t1Decode.x;
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
    `source-tissue-relief-v4${withNetworks ? '-network' : ''}`;
}

export function createAnatomicalMaterial(mesh, region, appearance) {
  const material = new MeshPhysicalMaterial();
  MeshStandardMaterial.prototype.copy.call(material, mesh.material);
  material.roughness = appearance.tissue.roughness;
  // The coat lobe is a second lighting pass. On a phone it is what drops the
  // frame; the coat itself is a thin sheen the small screen does not carry.
  material.clearcoat = isPhone() ? 0 : appearance.tissue.clearcoat;
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
