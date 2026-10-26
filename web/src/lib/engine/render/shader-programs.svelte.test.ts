import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { Mesh, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { patchCombinations } from './test-support.ts';

// Real WebGL: nothing else proves a patched shader compiles and links. Each distinct combination of
// patches is drawn once on one shared renderer at a desktop viewport and again at a phone viewport,
// where the coat is dropped, so a program two combinations share, or that fails to link, shows in
// the renderer's program list. The cut material is the same on both.
const COMPILE_TIMEOUT_MS = 120_000;
const DISTINCT = 19;
const SAME_ON_BOTH = 2;

test(
  'SHADER-35 every combination of patches the app uses links under real WebGL, on desktop and on a phone, and gets its own program',
  { timeout: COMPILE_TIMEOUT_MS },
  async () => {
    const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
    renderer.debug.checkShaderErrors = true;
    const camera = new PerspectiveCamera();
    camera.position.z = 1;
    const materials: { dispose(): void }[] = [];
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      await page.viewport(width, height);
      const combinations = patchCombinations();
      expect(combinations.size).toBe(DISTINCT);
      for (const [name, material] of combinations) {
        const scene = new Scene();
        scene.add(new Mesh(new PlaneGeometry(0.1, 0.1), material));
        try {
          renderer.render(scene, camera);
        } catch (error) {
          throw new Error(`${name} at ${width}: ${(error as Error).message}`);
        }
        materials.push(material);
      }
    }
    const programs = renderer.info.programs! as unknown as {
      name: string;
      cacheKey: string;
      diagnostics?: { runnable: boolean };
    }[];
    expect(programs).toHaveLength(2 * (DISTINCT - SAME_ON_BOTH) + SAME_ON_BOTH);
    const failed = programs
      .filter((program) => program.diagnostics && !program.diagnostics.runnable)
      .map(
        (program) =>
          `${program.name} ${program.cacheKey.slice(-80)}: ${JSON.stringify(program.diagnostics)}`,
      );
    expect(failed).toEqual([]);
    for (const material of materials) material.dispose();
    renderer.dispose();
  },
);
