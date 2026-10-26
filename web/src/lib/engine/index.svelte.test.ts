import { expect, onTestFinished, test, vi } from 'vitest';
import '../../styles/tokens.css';
import outlineUrl from '../../../../public/diffusion/cdmd-sub-013/brain-outline.json?url';
import manifestUrl from '../../../../public/models/cdmd/manifest.json?url';
import { defineEngineContract } from './fake/contract-suite.ts';
import { createEngine } from './index.ts';

// The tract data is served from the site's `diffusion/` directory, which this project has no public
// directory to answer for: its requests are redirected to the repository's files.
const diffusionRoot = outlineUrl.slice(0, outlineUrl.indexOf('cdmd-sub-013'));
const fetchSite = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const at = url.indexOf('/neuroatlas/diffusion/');
  return fetchSite(
    at < 0 ? input : diffusionRoot + url.slice(at + '/neuroatlas/diffusion/'.length),
    init,
  );
};

// Each case boots the engine, which parses 35 MB of GLB on a software GL context.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

// The real engine on the CDMD manifest, on real WebGL (SwiftShader), against the contract the fake meets.
// The stage has room: the sheet case shrinks the visible rectangle.
async function boot() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:700px';
  document.body.append(host);
  onTestFinished(() => host.remove());
  return createEngine({ host, manifestUrl, theme: 'light' });
}

// The navigator sizes its canvas from the parent it sits in.
const canvas = document.createElement('canvas');
const parent = document.createElement('div');
document.body.append(parent);
parent.append(canvas);

defineEngineContract('real engine', boot, {
  canvas,
  comparison: {
    id: 'overlap:left:-1:0',
    geometry: {
      file: 'atlas-overlaps.glb',
      sha256: 'c6ebb202fc9ec9852cc75ae8e6023d7efdd85e10e084abc3901e65d397b1d80c',
    },
  },
});

test('captures the settled frame, cropped to the stage rectangle asked for, with the brain drawn', async () => {
  const engine = await boot();
  onTestFinished(() => engine.dispose());
  const { canvas, ratio } = engine.captureSnapshot({ x: 100, y: 50, width: 400, height: 300 });
  expect([canvas.width, canvas.height]).toEqual([Math.round(400 * ratio), Math.round(300 * ratio)]);
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const colours = new Set<number>();
  for (let at = 0; at < pixels.length; at += 4 * 97) {
    colours.add((pixels[at]! << 16) | (pixels[at + 1]! << 8) | pixels[at + 2]!);
  }
  // A uniform stage would be an empty one.
  expect(colours.size).toBeGreaterThan(8);
  expect(engine.canvas.getAttribute('role')).toBe('application');
});
