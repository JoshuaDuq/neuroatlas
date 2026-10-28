import { DataTexture, NearestFilter, RedFormat, UnsignedByteType } from 'three';
import type { IUniform, Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { SOFT_SHARE } from '../../core/catalog/boundary-certainty.ts';
import type { BoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';
import { LABEL_AT } from './label-sampling.ts';

/**
 * The selected region's outline on a NextBrain cut, inked by how often the model
 * nearly tied each boundary: solid where firm, dashed where soft, grey where unrated.
 */
export interface EdgeUniforms {
  edgeEnabled: IUniform<boolean>;
  edgePairs: IUniform<DataTexture>;
  edgeWidth: IUniform<number>;
  edgeSoft: IUniform<number>;
  [uniform: string]: IUniform;
}

export function createEdgeUniforms(): EdgeUniforms {
  return {
    edgeEnabled: { value: false },
    edgePairs: { value: pairTexture(new Map(), 1, []) },
    // In screen pixels: the outline's half-width and the dash period's unit.
    edgeWidth: { value: 1.5 },
    edgeSoft: { value: SOFT_SHARE },
  };
}

/** A symmetric code-by-code table: 0 for an unrated pair, else 1 + near-tie share × 254. */
export function pairTexture(
  codes: ReadonlyMap<string, number>,
  size: number,
  pairs: BoundaryCertainty['pairs'],
): DataTexture {
  const table = new Uint8Array(size * size);
  for (const [a, b, voxels, near] of pairs) {
    const i = codes.get(a);
    const j = codes.get(b);
    // A label too thin to win any cut block has no code, and never meets another on a cut.
    if (i === undefined || j === undefined) continue;
    const value = 1 + Math.round((near / voxels) * 254);
    table[i * size + j] = value;
    table[j * size + i] = value;
  }
  const texture = new DataTexture(table, size, size, RedFormat, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/** The GLSL names a material samples its labels and selection through. */
export interface EdgeSource {
  volume: string;
  shape: string;
  toLabels: string;
  enabled: string;
  selected: string;
}

/** Ink the selected region's boundaries over the lit face; applied after every other appearance. */
export function addBoundaryEdges(
  material: Material,
  uniforms: EdgeUniforms,
  source: EdgeSource,
): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `
      uniform bool edgeEnabled;
      uniform sampler2D edgePairs;
      uniform float edgeWidth;
      uniform float edgeSoft;
      vec3 edgeDx;
      vec3 edgeDy;
      ${LABEL_AT}
      float edgeShare(uint a, uint b) {
        float value = texelFetch(edgePairs, ivec2(int(a), int(b)), 0).r * 255.0;
        return value < 0.5 ? -1.0 : (value - 1.0) / 254.0;
      }
      // A boundary of the selection: the selection's side takes its highest-rated neighbour.
      void edgeVisit(uint here, uint other, float selected, inout float share, inout bool meets) {
        if (other == here || other == 0u) return;
        if (float(here) != selected && float(other) != selected) return;
        meets = true;
        share = max(share, edgeShare(here, other));
      }
      ${shader.fragmentShader}`
      // Derivatives are taken before any discard, while the whole quad still runs.
      .replace(
        'void main() {',
        `void main() {
        edgeDx = dFdx(sourceWorld);
        edgeDy = dFdy(sourceWorld);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `
        if (edgeEnabled && (${source.enabled})) {
          mat3 toVoxel = mat3(${source.toLabels});
          vec3 at = (${source.toLabels} * vec4(sourceWorld, 1.0)).xyz;
          vec3 sx = toVoxel * edgeDx * edgeWidth;
          vec3 sy = toVoxel * edgeDy * edgeWidth;
          uint here = labelAt(${source.volume}, ${source.shape}, at);
          float selected = ${source.selected};
          float share = -1.0;
          bool acrossX = false;
          bool acrossY = false;
          edgeVisit(here, labelAt(${source.volume}, ${source.shape}, at + sx), selected, share, acrossX);
          edgeVisit(here, labelAt(${source.volume}, ${source.shape}, at - sx), selected, share, acrossX);
          edgeVisit(here, labelAt(${source.volume}, ${source.shape}, at + sy), selected, share, acrossY);
          edgeVisit(here, labelAt(${source.volume}, ${source.shape}, at - sy), selected, share, acrossY);
          if (here > 0u && (acrossX || acrossY)) {
            // Dashes run along the line: a boundary crossed in x is a vertical line.
            float along = acrossX ? gl_FragCoord.y : gl_FragCoord.x;
            // Two-tone dashes stay legible on pale white matter and on dark parcels alike.
            float dash = step(0.5, fract(along / (5.0 * edgeWidth)));
            vec3 dashInk = mix(vec3(0.002), vec3(0.88), dash);
            vec4 ink = share < 0.0 ? vec4(vec3(0.35), 0.8)
              : vec4(share >= edgeSoft ? dashInk : vec3(0.002), 0.95);
            outgoingLight = mix(outgoingLight, ink.rgb, ink.a);
          }
        }
        #include <opaque_fragment>
      `,
      );
  };
  material.customProgramCacheKey = () => `${key}-boundary-edges`;
  material.needsUpdate = true;
}
