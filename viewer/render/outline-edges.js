import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

/**
 * Whether two outline lists name the same meshes.
 *
 * The halo and the core often trace one region. Comparing identity, not
 * order, lets the core reuse the halo's mask instead of drawing the scene
 * again.
 */
export function sameMeshSet(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!b.includes(a[i])) return false;
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
export function paintOutlineEdges(pass, maskTexture, renderer, readBuffer, maskActive) {
  renderer.getClearColor(pass._oldClearColor);
  const oldClearAlpha = renderer.getClearAlpha();
  pass.oldClearAlpha = oldClearAlpha;
  const oldAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  try {
    if (maskActive) renderer.state.buffers.stencil.setTest(false);
    renderer.setClearColor(0xffffff, 1);

    pass._fsQuad.material = pass.materialCopy;
    pass.copyUniforms.tDiffuse.value = maskTexture;
    renderer.setRenderTarget(pass.renderTargetMaskDownSampleBuffer);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass.tempPulseColor1.copy(pass.visibleEdgeColor);
    pass.tempPulseColor2.copy(pass.hiddenEdgeColor);
    if (pass.pulsePeriod > 0) {
      const scalar = (1 + 0.25) / 2
        + Math.cos(performance.now() * 0.01 / pass.pulsePeriod) * (1.0 - 0.25) / 2;
      pass.tempPulseColor1.multiplyScalar(scalar);
      pass.tempPulseColor2.multiplyScalar(scalar);
    }

    pass._fsQuad.material = pass.edgeDetectionMaterial;
    pass.edgeDetectionMaterial.uniforms.maskTexture.value = pass.renderTargetMaskDownSampleBuffer.texture;
    pass.edgeDetectionMaterial.uniforms.texSize.value.set(
      pass.renderTargetMaskDownSampleBuffer.width,
      pass.renderTargetMaskDownSampleBuffer.height,
    );
    pass.edgeDetectionMaterial.uniforms.visibleEdgeColor.value = pass.tempPulseColor1;
    pass.edgeDetectionMaterial.uniforms.hiddenEdgeColor.value = pass.tempPulseColor2;
    renderer.setRenderTarget(pass.renderTargetEdgeBuffer1);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass._fsQuad.material = pass.separableBlurMaterial1;
    pass.separableBlurMaterial1.uniforms.colorTexture.value = pass.renderTargetEdgeBuffer1.texture;
    pass.separableBlurMaterial1.uniforms.direction.value = OutlinePass.BlurDirectionX;
    pass.separableBlurMaterial1.uniforms.kernelRadius.value = pass.edgeThickness;
    renderer.setRenderTarget(pass.renderTargetBlurBuffer1);
    renderer.clear();
    pass._fsQuad.render(renderer);
    pass.separableBlurMaterial1.uniforms.colorTexture.value = pass.renderTargetBlurBuffer1.texture;
    pass.separableBlurMaterial1.uniforms.direction.value = OutlinePass.BlurDirectionY;
    renderer.setRenderTarget(pass.renderTargetEdgeBuffer1);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass._fsQuad.material = pass.separableBlurMaterial2;
    pass.separableBlurMaterial2.uniforms.colorTexture.value = pass.renderTargetEdgeBuffer1.texture;
    pass.separableBlurMaterial2.uniforms.direction.value = OutlinePass.BlurDirectionX;
    renderer.setRenderTarget(pass.renderTargetBlurBuffer2);
    renderer.clear();
    pass._fsQuad.render(renderer);
    pass.separableBlurMaterial2.uniforms.colorTexture.value = pass.renderTargetBlurBuffer2.texture;
    pass.separableBlurMaterial2.uniforms.direction.value = OutlinePass.BlurDirectionY;
    renderer.setRenderTarget(pass.renderTargetEdgeBuffer2);
    renderer.clear();
    pass._fsQuad.render(renderer);

    pass._fsQuad.material = pass.overlayMaterial;
    pass.overlayMaterial.uniforms.maskTexture.value = maskTexture;
    pass.overlayMaterial.uniforms.edgeTexture1.value = pass.renderTargetEdgeBuffer1.texture;
    pass.overlayMaterial.uniforms.edgeTexture2.value = pass.renderTargetEdgeBuffer2.texture;
    pass.overlayMaterial.uniforms.patternTexture.value = pass.patternTexture;
    pass.overlayMaterial.uniforms.edgeStrength.value = pass.edgeStrength;
    pass.overlayMaterial.uniforms.edgeGlow.value = pass.edgeGlow;
    pass.overlayMaterial.uniforms.usePatternTexture.value = pass.usePatternTexture;

    if (maskActive) renderer.state.buffers.stencil.setTest(true);
    renderer.setRenderTarget(readBuffer);
    pass._fsQuad.render(renderer);
  } finally {
    renderer.setClearColor(pass._oldClearColor, oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
}
