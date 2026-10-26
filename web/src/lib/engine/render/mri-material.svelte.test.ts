import { afterAll, expect, test } from 'vitest';
import {
  Data3DTexture,
  FloatType,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import {
  addMriAppearance,
  createMriUniforms,
  setMriHighlight,
  setMriWindow,
} from './mri-material.ts';

// Real WebGL: what a mark does to a cut face is what the fragment shader writes.
const SIGNAL = 100;
// A WebGL context on SwiftShader is slow to create and each material compiles its own shader, so one
// renderer serves both tests and each test gets room for a loaded machine (an idle one needs under 1 s).
const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
afterAll(() => renderer.dispose());
const SHADER_COMPILE_TIMEOUT_MS = 30_000;

const oetf = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

/** The display colour the shader writes for a constant scan value, with `mark` as the mark amount. */
function render(mark: string): [number, number, number] {
  const texture = new Data3DTexture(new Uint8Array(8).fill(SIGNAL), 2, 2, 2);
  texture.format = RedFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  const uniforms = createMriUniforms({
    texture,
    // The quad spans -0.25..0.25, which this puts inside the 2-voxel grid.
    worldToVoxel: new Matrix4().makeTranslation(0.5, 0.5, 0.5),
    volume: { shape: [2, 2, 2] },
  });
  uniforms.scanEnabled.value = true;
  // A window centred above the signal leaves the unmarked grey at 0.25, room for a lift.
  setMriWindow(uniforms, 150, 200);
  setMriHighlight(uniforms, '#4fb6e0');
  const material = new MeshPhysicalMaterial();
  addMriAppearance(material, uniforms, mark);

  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(0.5, 0.5), material));
  const camera = new OrthographicCamera(-0.25, 0.25, 0.25, -0.25, 0.1, 10);
  camera.position.z = 1;
  const target = new WebGLRenderTarget(4, 4, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixel = new Float32Array(4);
  renderer.readRenderTargetPixels(target, 1, 1, 1, 1, pixel);

  target.dispose();
  material.dispose();
  texture.dispose();
  renderer.setRenderTarget(null);
  return [oetf(pixel[0]!), oetf(pixel[1]!), oetf(pixel[2]!)];
}

const luma = ([red, green, blue]: number[]) => 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;

test(
  'an unmarked cut face is the scan grey, with no hue',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const [red, green, blue] = render('0.0');
    // (100 - 150 + 100) / 200 of the window.
    expect(red).toBeCloseTo(0.25, 2);
    expect(green).toBeCloseTo(red, 3);
    expect(blue).toBeCloseTo(red, 3);
  },
);

test(
  'a marked cut face takes the accent as hue at the lifted grey, instead of washing toward white',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const tone = render('1.0');
    const [red, , blue] = tone as [number, number, number];
    // The mark moves hue toward the accent (#4fb6e0 is blue-green)...
    expect(blue - red).toBeGreaterThan(0.2);
    // ...while luma is the grey lifted by 0.33, not white: a luminance-only mark would
    // read as brighter tissue.
    expect(luma(tone)).toBeCloseTo(0.25 + 0.33, 2);
    expect(luma(tone)).toBeLessThan(0.9);
  },
);
