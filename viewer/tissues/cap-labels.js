import { Matrix4, Vector2, Vector3 } from 'three';

/** Cut-only atlases identify regions inside smooth envelopes, without meshes. */
export function createCapLabels() {
  return {
    capLabelsEnabled: { value: false },
    capLabelVolume: { value: null },
    capLabelPalette: { value: null },
    capWorldToLabels: { value: new Matrix4() },
    capLabelShape: { value: new Vector3() },
    capHighlightCodes: { value: new Vector2(-1, -1) },
    capHighlightLifts: { value: new Vector2() },
    capIsolated: { value: false },
  };
}

export function updateCapLabels(uniforms, layer, state) {
  uniforms.capLabelsEnabled.value = state.surfaceColor === 'mri' && !layer.wedged;
  uniforms.capLabelVolume.value = layer.texture;
  uniforms.capLabelPalette.value = layer.palette;
  uniforms.capWorldToLabels.value = layer.uniforms.worldToVoxel.value;
  uniforms.capLabelShape.value = layer.uniforms.volumeShape.value;
  uniforms.capHighlightCodes.value = layer.uniforms.highlightCodes.value;
  uniforms.capHighlightLifts.value = layer.uniforms.highlightLifts.value;
  uniforms.capIsolated.value = Boolean(state.isolatedRegion);
}

export function addCapLabels(material, uniforms) {
  material.userData.sampledLabels = { value: false };
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.capSampleLabels = material.userData.sampledLabels;
    shader.fragmentShader = `
      uniform bool capLabelsEnabled;
      uniform bool capSampleLabels;
      uniform highp usampler3D capLabelVolume;
      uniform sampler2D capLabelPalette;
      uniform mat4 capWorldToLabels;
      uniform ivec3 capLabelShape;
      uniform vec2 capHighlightCodes;
      uniform vec2 capHighlightLifts;
      uniform bool capIsolated;
      ${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
        if (capLabelsEnabled && capSampleLabels) {
          ivec3 cell = ivec3(floor(
            (capWorldToLabels * vec4(sourceWorld, 1.0)).xyz + 0.5));
          uint code = uint(0);
          if (all(greaterThanEqual(cell, ivec3(0))) && all(lessThan(cell, capLabelShape))) {
            code = texelFetch(capLabelVolume, cell, 0).r;
          }
          float visible = texelFetch(capLabelPalette, ivec2(int(code), 0), 0).a;
          if ((code > uint(0) || capIsolated) && visible < 0.5) discard;
          float here = float(code);
          capLift = here == capHighlightCodes.y ? capHighlightLifts.y
            : here == capHighlightCodes.x ? capHighlightLifts.x : 0.0;
        }
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => `${key}-cap-labels`;
}
