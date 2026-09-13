import { DoubleSide, MeshPhysicalMaterial, Vector3 } from 'three';
import { HIGHLIGHT_CHUNK } from './highlight.js';
import { WHITE_MATTER_LIFT, WHITE_MATTER_UNIFORMS } from './white-matter.js';

/** Registered MRI adds material variation; the solid geometry owns all boundaries. */
export function createSolidMaterial(anatomy, appearance, whiteMatter = null) {
  const { tissue, intensity } = appearance;
  const material = new MeshPhysicalMaterial({
    side: DoubleSide, roughness: tissue.roughness,
    clearcoat: tissue.clearcoat, clearcoatRoughness: tissue.clearcoat_roughness,
    ior: tissue.ior, specularIntensity: tissue.specular_intensity,
  });
  material.userData.tissueVariation = { value: intensity.cut_strength };
  // One solid is one region, so a cap carries its own lift rather than
  // comparing an identity the way a sampled face has to.
  material.userData.highlightLift = { value: 0 };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      mriVolume: { value: anatomy.texture },
      worldToMri: { value: anatomy.worldToVoxel },
      mriShape: { value: new Vector3(...anatomy.volume.shape) },
      t1Range: { value: [intensity.low, intensity.high] },
      // A cut face carries the T1 contrast the cut was tuned against, not the
      // surface's; a published palette gets none, as the voxel cut gets none.
      tissueVariation: material.userData.tissueVariation,
      tissueRelief: { value: intensity.solid_relief_mm / 1000 },
      highlightLift: material.userData.highlightLift,
      ...whiteMatter?.uniforms,
    });
    shader.vertexShader = `varying vec3 sourceWorld;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>', `#include <begin_vertex>
      sourceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = `
      uniform highp sampler3D mriVolume;
      uniform mat4 worldToMri;
      uniform vec3 mriShape;
      uniform vec2 t1Range;
      uniform float tissueVariation;
      uniform float tissueRelief;
      uniform float highlightLift;
      varying vec3 sourceWorld;${whiteMatter ? WHITE_MATTER_UNIFORMS : ''}
      ${HIGHLIGHT_CHUNK}

      float intensityAt(vec3 voxel) {
        float t1 = texture(mriVolume, (voxel + 0.5) / mriShape).r * 255.0;
        return clamp((t1 - t1Range.x) / (t1Range.y - t1Range.x), 0.0, 1.0);
      }

      vec3 intensityGradient(vec3 voxel) {
        vec3 gradient = 0.5 * vec3(
          intensityAt(voxel + vec3(1, 0, 0)) - intensityAt(voxel - vec3(1, 0, 0)),
          intensityAt(voxel + vec3(0, 1, 0)) - intensityAt(voxel - vec3(0, 1, 0)),
          intensityAt(voxel + vec3(0, 0, 1)) - intensityAt(voxel - vec3(0, 0, 1)));
        // Covector transform: voxel gradient to view space, in inverse meters.
        return mat3(viewMatrix) * transpose(mat3(worldToMri)) * gradient;
      }
      ${shader.fragmentShader}`.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 mriVoxel = (worldToMri * vec4(sourceWorld, 1.0)).xyz;
        float intensity = intensityAt(mriVoxel);
        diffuseColor.rgb *= 1.0 + tissueVariation * (2.0 * intensity - 1.0);
        float capLift = highlightLift;${whiteMatter ? WHITE_MATTER_LIFT : ''}
        diffuseColor.rgb = liftHighlight(diffuseColor.rgb, capLift);
      `).replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        vec3 gradient = intensityGradient(mriVoxel);
        vec3 tangentGradient = gradient - normal * dot(gradient, normal);
        normal = normalize(normal - tissueRelief * tangentGradient * faceDirection);
      `).replace('#include <clearcoat_normal_fragment_maps>', `
        #include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = normal;
        #endif
      `);
  };
  material.customProgramCacheKey = () =>
    `native-solid-tissue-v2${whiteMatter ? '-white-matter' : ''}`;
  return material;
}
