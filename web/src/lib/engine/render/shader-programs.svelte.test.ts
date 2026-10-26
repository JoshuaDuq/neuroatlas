import { expect, test } from 'vitest';
import { Mesh, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { patchCombinations } from './test-support.ts';

// Real WebGL: nothing else proves a patched shader compiles and links. Each distinct combination of
// patches is drawn once on one shared renderer, so a program that two combinations share, or that
// fails to link, shows in the renderer's program list.
const COMPILE_TIMEOUT_MS = 120_000;

test(
  'SHADER-35 every combination of patches the app uses links under real WebGL and gets its own program',
  { timeout: COMPILE_TIMEOUT_MS },
  () => {
    const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
    renderer.debug.checkShaderErrors = true;
    const camera = new PerspectiveCamera();
    camera.position.z = 1;
    const combinations = patchCombinations();
    expect(combinations.size).toBe(19);
    for (const [name, material] of combinations) {
      const scene = new Scene();
      scene.add(new Mesh(new PlaneGeometry(0.1, 0.1), material));
      try {
        renderer.render(scene, camera);
      } catch (error) {
        throw new Error(`${name}: ${(error as Error).message}`);
      }
    }
    const programs = renderer.info.programs! as unknown as {
      name: string;
      cacheKey: string;
      diagnostics?: { runnable: boolean };
    }[];
    expect(programs).toHaveLength(combinations.size);
    const failed = programs
      .filter((program) => program.diagnostics && !program.diagnostics.runnable)
      .map(
        (program) =>
          `${program.name} ${program.cacheKey.slice(-80)}: ${JSON.stringify(program.diagnostics)}`,
      );
    expect(failed).toEqual([]);
    for (const material of combinations.values()) material.dispose();
    renderer.dispose();
  },
);
