import { Matrix4, Vector2, Vector3 } from 'three';
import type {
  Data3DTexture,
  DataTexture,
  IUniform,
  Material,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';
import type { DisplaySettings } from '../../types/index.ts';
import { LABEL_AT } from './label-sampling.ts';

/** The uniforms a cap reads its sampled labels from. */
export interface CapLabelUniforms {
  capLabelsEnabled: IUniform<boolean>;
  capLabelVolume: IUniform<Data3DTexture | null>;
  capLabelPalette: IUniform<DataTexture | null>;
  capWorldToLabels: IUniform<Matrix4>;
  capLabelShape: IUniform<Vector3>;
  capHighlightCodes: IUniform<Vector2>;
  capHighlightLifts: IUniform<Vector2>;
  capIsolated: IUniform<boolean>;
  [uniform: string]: IUniform;
}

/** The part of a cut layer (E4a) that the caps sample. */
export interface CutLayer {
  texture: Data3DTexture;
  palette: DataTexture;
  wedged: boolean;
  uniforms: {
    worldToVoxel: IUniform<Matrix4>;
    volumeShape: IUniform<Vector3>;
    highlightCodes: IUniform<Vector2>;
    highlightLifts: IUniform<Vector2>;
  };
}

/** Cut-only atlases identify regions inside smooth envelopes, without meshes. */
export function createCapLabels(): CapLabelUniforms {
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

export function updateCapLabels(
  uniforms: CapLabelUniforms,
  layer: CutLayer,
  state: Pick<DisplaySettings, 'surfaceColor' | 'isolatedRegion'>,
): void {
  uniforms.capLabelsEnabled.value = state.surfaceColor === 'mri' && !layer.wedged;
  uniforms.capLabelVolume.value = layer.texture;
  uniforms.capLabelPalette.value = layer.palette;
  uniforms.capWorldToLabels.value = layer.uniforms.worldToVoxel.value;
  uniforms.capLabelShape.value = layer.uniforms.volumeShape.value;
  uniforms.capHighlightCodes.value = layer.uniforms.highlightCodes.value;
  uniforms.capHighlightLifts.value = layer.uniforms.highlightLifts.value;
  uniforms.capIsolated.value = Boolean(state.isolatedRegion);
}

export function addCapLabels(material: Material, uniforms: CapLabelUniforms): void {
  material.userData.sampledLabels = { value: false };
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
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
      ${LABEL_AT}
      ${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `
        if (capLabelsEnabled && capSampleLabels) {
          uint code = labelAt(capLabelVolume, capLabelShape,
            (capWorldToLabels * vec4(sourceWorld, 1.0)).xyz);
          float visible = texelFetch(capLabelPalette, ivec2(int(code), 0), 0).a;
          if ((code > uint(0) || capIsolated) && visible < 0.5) discard;
          float here = float(code);
          capLift = here == capHighlightCodes.y ? capHighlightLifts.y
            : here == capHighlightCodes.x ? capHighlightLifts.x : 0.0;
        }
        #include <opaque_fragment>
      `,
    );
  };
  material.customProgramCacheKey = () => `${key}-cap-labels-v2`;
}
