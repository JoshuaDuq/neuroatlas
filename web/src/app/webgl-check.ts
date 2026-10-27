export type MissingWebgl = 'webgl2' | 'floatTargets';

/**
 * What this browser's WebGL lacks for the renderer, or null (main.js:30). Integer 3D textures
 * carry the label grids (WebGL 2), and the frame is drawn into half-float multisampled targets
 * (EXT_color_buffer_float). There is no fallback path, and reloading will not help, so the
 * failure screen offers no retry for these.
 */
export function missingWebgl(): MissingWebgl | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = document.createElement('canvas').getContext('webgl2');
  } catch {
    // Some privacy modes throw rather than return null.
  }
  if (!gl) return 'webgl2';
  const float = gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return float ? null : 'floatTargets';
}
