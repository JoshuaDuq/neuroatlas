import { DoubleSide, MeshPhysicalMaterial } from 'three';

/** Light the cut as tissue; sample categorical identity before continuous T1. */
export function createCutMaterial(uniforms, tissue) {
  const material = new MeshPhysicalMaterial({
    side: DoubleSide,
    roughness: tissue.roughness,
    clearcoat: tissue.clearcoat,
    clearcoatRoughness: tissue.clearcoat_roughness,
    ior: tissue.ior,
    specularIntensity: tissue.specular_intensity,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 sourceWorld;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      sourceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = `
      precision highp usampler3D;
      uniform highp usampler3D labelVolume;
      uniform sampler2D labelPalette;
      uniform mat4 worldToVoxel;
      uniform ivec3 volumeShape;
      uniform highp sampler3D mriVolume;
      uniform mat4 worldToMri;
      uniform vec3 mriShape;
      uniform vec2 t1Range;
      uniform float tissueVariation;
      varying vec3 sourceWorld;
      ${shader.fragmentShader}`.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 voxel = (worldToVoxel * vec4(sourceWorld, 1.0)).xyz;
        ivec3 cell = ivec3(floor(voxel + vec3(0.5)));
        if (any(lessThan(cell, ivec3(0))) ||
            any(greaterThanEqual(cell, volumeShape))) discard;
        uint code = texelFetch(labelVolume, cell, 0).r;
        vec4 tissue = texelFetch(labelPalette, ivec2(int(code), 0), 0);
        if (tissue.a < 0.5) discard;
        vec3 mriVoxel = (worldToMri * vec4(sourceWorld, 1.0)).xyz;
        // Texture coordinates address voxel centers, not voxel corners.
        float t1 = texture(mriVolume, (mriVoxel + 0.5) / mriShape).r * 255.0;
        float intensity = clamp((t1 - t1Range.x) / (t1Range.y - t1Range.x), 0.0, 1.0);
        diffuseColor = vec4(tissue.rgb *
          (1.0 + tissueVariation * (2.0 * intensity - 1.0)), 1.0);
      `);
  };
  material.customProgramCacheKey = () => 'registered-tissue-cut-v2';
  return material;
}
