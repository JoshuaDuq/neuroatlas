import { Color, LinearSRGBColorSpace, Vector2, Vector3 } from 'three';

/**
 * How a mark reads where the scan already owns luminance.
 *
 * `lift` is how much of it moves brightness: enough to survive greyscale and
 * a colour-blind reader, not enough for a marked cortex to pass for white
 * matter. `tint` is how much moves hue, which an achromatic scan leaves free.
 */
export const MRI_MARK = { lift: 0.33, tint: 1.8 };

const glsl = value => (Number.isInteger(value) ? `${value}.0` : `${value}`);

/** One scan, contrast window and mark colour shared by every surface and cut material. */
export function createMriUniforms(anatomy) {
  return {
    scanEnabled: { value: false },
    scanVolume: { value: anatomy.texture },
    worldToScan: { value: anatomy.worldToVoxel },
    scanShape: { value: new Vector3(...anatomy.volume.shape) },
    scanWindow: { value: new Vector2() },
    scanHighlight: { value: new Color().setStyle('#4fb6e0', LinearSRGBColorSpace) },
  };
}

export function setMriWindow(uniforms, center, width) {
  if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
    throw new RangeError('MRI window requires a finite center and positive width.');
  }
  uniforms.scanWindow.value.set(center, width);
}

/**
 * The colour a pointed-at or chosen cut face is marked with, from the theme.
 *
 * Stored as the display bytes the token spells, not converted to the working
 * space, because the mark is mixed into a display grey and decoded with it.
 */
export function setMriHighlight(uniforms, color) {
  if (typeof color !== 'string' || !color.trim()) {
    throw new RangeError('MRI highlight requires a CSS colour.');
  }
  uniforms.scanHighlight.value.setStyle(color.trim(), LinearSRGBColorSpace);
}

/** Preserve the material's clipping and label logic, replacing only its light. */
export function addMriAppearance(material, uniforms, highlight = '0.0') {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 scanWorld;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>', `#include <begin_vertex>
      scanWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = `
      uniform bool scanEnabled;
      uniform highp sampler3D scanVolume;
      uniform mat4 worldToScan;
      uniform vec3 scanShape;
      uniform vec2 scanWindow;
      uniform vec3 scanHighlight;
      varying vec3 scanWorld;
      ${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
        if (scanEnabled) {
          vec3 voxel = (worldToScan * vec4(scanWorld, 1.0)).xyz;
          float signal = 0.0;
          if (all(greaterThanEqual(voxel, vec3(0.0))) &&
              all(lessThanEqual(voxel, scanShape - 1.0))) {
            signal = texture(scanVolume, (voxel + 0.5) / scanShape).r * 255.0;
          }
          float gray = clamp((signal - scanWindow.x + scanWindow.y * 0.5)
            / scanWindow.y, 0.0, 1.0);
          // The scan is the luminance channel, so a mark rides on hue instead:
          // the accent normalised to unit luma, scaled by the scan's own
          // brightness, which tints the face without flattening the tissue
          // under it. Lifting toward white would read as brighter tissue.
          float mark = ${highlight};
          float lifted = clamp(gray + mark * ${glsl(MRI_MARK.lift)}, 0.0, 1.0);
          vec3 hue = scanHighlight
            / max(dot(scanHighlight, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
          vec3 tone = clamp(mix(vec3(lifted), lifted * hue,
            min(mark * ${glsl(MRI_MARK.tint)}, 1.0)), 0.0, 1.0);
          // The linked canvas writes display grayscale bytes. Decode here so
          // the composer's sRGB output conversion returns the same values.
          outgoingLight = sRGBTransferEOTF(vec4(tone, 1.0)).rgb;
        }
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => `${key}-mri-${highlight}`;
  material.needsUpdate = true;
}
