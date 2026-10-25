import type {
  Color,
  IUniform,
  Object3D,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import type { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * `OutlinePass` fields that exist at runtime but that `@types/three` does not declare (it names
 * `oldClearColor` and `fsQuad`; the class has `_oldClearColor` and `_fsQuad`), plus the uniform
 * bags it types as `object`. Three.js is exact-pinned, so an upgrade needs this re-read.
 */
type OutlinePassInternals = OutlinePass & {
  _oldClearColor: Color;
  _fsQuad: FullScreenQuad;
  copyUniforms: Record<string, IUniform>;
};

/** The blur directions are statics `@types/three` omits. */
const Statics = OutlinePass as typeof OutlinePass & {
  BlurDirectionX: Vector2;
  BlurDirectionY: Vector2;
};

/**
 * Whether two outline lists name the same meshes.
 *
 * The halo and the core often trace one region. Comparing identity, not
 * order, lets the core reuse the halo's mask instead of drawing the scene
 * again.
 */
export function sameMeshSet(a: readonly Object3D[], b: readonly Object3D[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!b.includes(a[i]!)) return false;
  }
  return true;
}

/**
 * The fullscreen half of OutlinePass: downsample a mask, find its edges, blur
 * them, and add them to `readBuffer`.
 *
 * This is the tail of `OutlinePass.render` after the mask exists. Running it
 * from a mask another pass already drew skips a second depth render of every
 * mesh. The materials and targets belong to `pass`, so thickness and colour
 * stay that pass's.
 */
export function paintOutlineEdges(
  outlinePass: OutlinePass,
  maskTexture: Texture,
  renderer: WebGLRenderer,
  readBuffer: WebGLRenderTarget,
  maskActive: boolean,
): void {
  const pass = outlinePass as OutlinePassInternals;
  renderer.getClearColor(pass._oldClearColor);
  const oldClearAlpha = renderer.getClearAlpha();
  const oldAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  const stencil = renderer.state.buffers.stencil;
  let stencilSuspended = false;
  try {
    if (maskActive) {
      stencil.setTest(false);
      stencilSuspended = true;
    }
    renderer.setClearColor(0xffffff, 1);

    pass._fsQuad.material = pass.materialCopy;
    pass.copyUniforms.tDiffuse!.value = maskTexture;
    renderer.setRenderTarget(pass.renderTargetMaskDownSampleBuffer);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass.tempPulseColor1.copy(pass.visibleEdgeColor);
    pass.tempPulseColor2.copy(pass.hiddenEdgeColor);
    if (pass.pulsePeriod > 0) {
      const scalar =
        (1 + 0.25) / 2 +
        (Math.cos((performance.now() * 0.01) / pass.pulsePeriod) * (1.0 - 0.25)) / 2;
      pass.tempPulseColor1.multiplyScalar(scalar);
      pass.tempPulseColor2.multiplyScalar(scalar);
    }

    pass._fsQuad.material = pass.edgeDetectionMaterial;
    pass.edgeDetectionMaterial.uniforms.maskTexture!.value =
      pass.renderTargetMaskDownSampleBuffer.texture;
    pass.edgeDetectionMaterial.uniforms.texSize!.value.set(
      pass.renderTargetMaskDownSampleBuffer.width,
      pass.renderTargetMaskDownSampleBuffer.height,
    );
    pass.edgeDetectionMaterial.uniforms.visibleEdgeColor!.value = pass.tempPulseColor1;
    pass.edgeDetectionMaterial.uniforms.hiddenEdgeColor!.value = pass.tempPulseColor2;
    renderer.setRenderTarget(pass.renderTargetEdgeBuffer1);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass._fsQuad.material = pass.separableBlurMaterial1;
    pass.separableBlurMaterial1.uniforms.colorTexture!.value = pass.renderTargetEdgeBuffer1.texture;
    pass.separableBlurMaterial1.uniforms.direction!.value = Statics.BlurDirectionX;
    pass.separableBlurMaterial1.uniforms.kernelRadius!.value = pass.edgeThickness;
    renderer.setRenderTarget(pass.renderTargetBlurBuffer1);
    renderer.clear();
    pass._fsQuad.render(renderer);
    pass.separableBlurMaterial1.uniforms.colorTexture!.value = pass.renderTargetBlurBuffer1.texture;
    pass.separableBlurMaterial1.uniforms.direction!.value = Statics.BlurDirectionY;
    renderer.setRenderTarget(pass.renderTargetEdgeBuffer1);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass._fsQuad.material = pass.separableBlurMaterial2;
    pass.separableBlurMaterial2.uniforms.colorTexture!.value = pass.renderTargetEdgeBuffer1.texture;
    pass.separableBlurMaterial2.uniforms.direction!.value = Statics.BlurDirectionX;
    renderer.setRenderTarget(pass.renderTargetBlurBuffer2);
    renderer.clear();
    pass._fsQuad.render(renderer);
    pass.separableBlurMaterial2.uniforms.colorTexture!.value = pass.renderTargetBlurBuffer2.texture;
    pass.separableBlurMaterial2.uniforms.direction!.value = Statics.BlurDirectionY;
    renderer.setRenderTarget(pass.renderTargetEdgeBuffer2);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass._fsQuad.material = pass.overlayMaterial;
    pass.overlayMaterial.uniforms.maskTexture!.value = maskTexture;
    pass.overlayMaterial.uniforms.edgeTexture1!.value = pass.renderTargetEdgeBuffer1.texture;
    pass.overlayMaterial.uniforms.edgeTexture2!.value = pass.renderTargetEdgeBuffer2.texture;
    pass.overlayMaterial.uniforms.patternTexture!.value = pass.patternTexture;
    pass.overlayMaterial.uniforms.edgeStrength!.value = pass.edgeStrength;
    pass.overlayMaterial.uniforms.edgeGlow!.value = pass.edgeGlow;
    pass.overlayMaterial.uniforms.usePatternTexture!.value = pass.usePatternTexture;

    if (maskActive) {
      stencil.setTest(true);
      stencilSuspended = false;
    }
    renderer.setRenderTarget(readBuffer);
    pass._fsQuad.render(renderer);
  } finally {
    // A throw between the two stencil calls must not leave the mask's stencil test off.
    if (stencilSuspended) stencil.setTest(true);
    renderer.setClearColor(pass._oldClearColor, oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
}
