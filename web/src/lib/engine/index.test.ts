import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { Matrix4, Mesh } from 'three';
import type { Object3D } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { t } from '../core/i18n/index.ts';
import type { Engine } from './api.ts';
import { createEngine } from './index.ts';
import { createMriUniforms } from './render/mri-material.ts';
import { modelDirectory, publishedLoader, readManifest } from './model/test-support.ts';
import type { Outlined } from './render/scene.ts';

// The renderer needs a GL context, the model's files come from disk, and the scene and the overlay's
// geometry are spied on: this is the facade's wiring, not the drawing.
const stage = vi.hoisted(() => ({
  outlined: [] as (Outlined | undefined)[],
  attributes: new Map<string, string>(),
  overlap: null as unknown,
  overlayVisible: [] as boolean[],
  warmFails: false,
  scene: null as import('three').Scene | null,
  mriAppearance: [] as boolean[],
  rendererDisposed: 0,
  model: null as import('./model/brain-atlas.ts').BrainAtlas | null,
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      setAttribute(name: string, value: string) {
        stage.attributes.set(name, value);
      },
      remove() {},
      ownerDocument: new EventTarget(),
      getRootNode: () => new EventTarget(),
      setPointerCapture() {},
      releasePointerCapture() {},
      hasPointerCapture: () => false,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    ratio = 1;
    toneMapping = 0;
    getContext = () => null;
    setPixelRatio = (ratio: number) => {
      this.ratio = ratio;
    };
    getPixelRatio = () => this.ratio;
    setSize() {}
    initRenderTarget() {}
    setAnimationLoop() {}
    dispose() {
      stage.rendererDisposed++;
    }
    forceContextLoss() {}
  }
  return { ...original, WebGLRenderer: FakeRenderer };
});

// The studio environment is drawn on the GPU.
vi.mock('./render/lighting.ts', () => ({
  createAnatomicalLighting: () => ({ texture: null, dispose() {} }),
}));

vi.mock('./render/scene.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./render/scene.ts')>();
  return {
    ...original,
    createScene: (...args: Parameters<typeof original.createScene>) => {
      const scene = original.createScene(...args);
      return new Proxy(scene, {
        get(target, key) {
          if (key === 'setOutlined') {
            return (outlined?: Outlined) => {
              stage.outlined.push(outlined);
              target.setOutlined(outlined);
            };
          }
          if (key === 'setMriAppearance') {
            return (active: boolean) => {
              stage.mriAppearance.push(active);
              target.setMriAppearance(active);
            };
          }
          if (key === 'scene') stage.scene = target.scene;
          if (key === 'warmOutlines') {
            return () => {
              if (stage.warmFails) throw new Error('The outline programs did not compile.');
            };
          }
          return Reflect.get(target, key) as unknown;
        },
      });
    },
  };
});

vi.mock('./model/brain-atlas.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./model/brain-atlas.ts')>();
  class FromDisk extends original.BrainAtlas {
    static override async load(): Promise<InstanceType<typeof original.BrainAtlas>> {
      const model = new original.BrainAtlas(
        readManifest('cdmd'),
        publishedLoader(modelDirectory('cdmd')),
      );
      await model.initialize();
      stage.model = model;
      return model;
    }
  }
  return { ...original, BrainAtlas: FromDisk };
});

// The overlap's geometry is a file only the browser project fetches; its outline is the subject here.
vi.mock('./comparison/overlay.ts', async () => {
  const { Group } = await import('three');
  return {
    createComparisonOverlay: () => {
      const group = new Group();
      let active = false;
      return {
        group,
        get outlined() {
          return active && group.visible ? [stage.overlap as Object3D] : [];
        },
        async highlight() {
          active = true;
          return true;
        },
        clear() {
          active = false;
        },
        setVisible(visible: boolean) {
          group.visible = visible;
          stage.overlayVisible.push(visible);
        },
        dispose() {},
      };
    },
  };
});

beforeEach(() => {
  stage.outlined = [];
  stage.attributes.clear();
  stage.overlap = new Mesh();
  stage.overlayVisible = [];
  stage.warmFails = false;
  stage.mriAppearance = [];
  stage.rendererDisposed = 0;
  stage.model = null;
  vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('document', { documentElement: {} });
  vi.stubGlobal('location', { href: 'http://localhost/' });
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1' : '#808080'),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function boot(): Promise<Engine> {
  const host = Object.assign(new EventTarget(), {
    prepend() {},
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  return createEngine({
    host: host as unknown as HTMLElement,
    manifestUrl: 'http://localhost/models/cdmd/manifest.json',
    theme: 'light',
  });
}

const GEOMETRY = { file: 'atlas-overlaps.glb', sha256: '0'.repeat(64) };

describe('the engine facade', () => {
  it('words the canvas in the reader’s language, and as the reference when it is shown alone', async () => {
    const engine = await boot();
    engine.present({ lang: 'fr', referenceOnly: false });
    assert.equal(stage.attributes.get('aria-label'), t('fr', 'viewport').canvasLabel);
    assert.equal(stage.attributes.get('aria-roledescription'), t('fr', 'viewport').canvasRole);
    engine.present({ lang: 'en', referenceOnly: true });
    assert.equal(stage.attributes.get('aria-label'), t('en', 'diffusion').nativeCanvas);
    assert.equal(stage.attributes.get('aria-roledescription'), t('en', 'viewport').canvasRole);
    engine.dispose();
  });

  it('draws the overlap in place of the selection, and puts the selection back when it is hidden', async () => {
    const engine = await boot();
    const region = engine.model.manifest.regions.find(
      (candidate) => candidate.kind === 'cortex' && candidate.atlas === engine.model.settings.atlas,
    )!;
    engine.model.select(region.id);
    const drawn = () => stage.outlined.at(-1)!;
    assert.equal(drawn().selected!.length, 1, 'the selection is outlined');
    assert.equal(await engine.comparison.highlight('overlap', GEOMETRY), true);
    assert.deepEqual(drawn().selected, [stage.overlap], 'the overlap replaces the selection');
    // S1 hides the overlay when a cut opens; the outline must follow without another model change.
    stage.outlined = [];
    engine.comparison.setVisible(false);
    assert.deepEqual(stage.overlayVisible, [false]);
    assert.equal(stage.outlined.length, 1, 'setVisible redraws the outline itself');
    assert.equal(drawn().selected!.length, 1);
    assert.notDeepEqual(drawn().selected, [stage.overlap]);
    engine.comparison.setVisible(true);
    assert.deepEqual(drawn().selected, [stage.overlap]);
    engine.comparison.clear();
    assert.notDeepEqual(drawn().selected, [stage.overlap]);
    engine.dispose();
  });

  it('keeps every model change in one change event with the cut’s state beside it', async () => {
    const engine = await boot();
    const changes: unknown[] = [];
    engine.on('change', (change) => changes.push(change));
    engine.model.setHemisphere('left');
    const last = changes.at(-1) as { model: { hemisphere: string }; sections: { mode: string } };
    assert.equal(last.model.hemisphere, 'left');
    assert.equal(last.sections.mode, 'off');
    engine.dispose();
  });

  // Deviation e7-warm-outlines-fail-fast: legacy logged the failure and started anyway.
  it('rejects when the outline programs cannot be compiled, freeing the scene and the model', async () => {
    stage.warmFails = true;
    await assert.rejects(boot(), /outline programs did not compile/);
    assert.equal(stage.rendererDisposed, 1);
    assert.equal(stage.model!.disposed, true);
  });

  it('opens with the cut hidden, and shows the scan on the surface only while nothing paints it', async () => {
    const engine = await boot();
    const cut = stage.scene!.children.find((child) => child.name === 'GPU labelled brain sections');
    assert.equal(cut?.visible, false, 'no cut is drawn until one is chosen');
    stage.model!.setMriAnatomy({
      mriUniforms: createMriUniforms({
        texture: null,
        worldToVoxel: new Matrix4(),
        volume: { shape: [1, 1, 1] },
      }),
    });
    engine.model.setSurfaceColor('mri');
    assert.equal(stage.mriAppearance.at(-1), true);
    const region = engine.model.manifest.regions.find((candidate) => candidate.kind === 'cortex')!;
    engine.model.setPaint({ id: 'paint', colors: new Map([[region.id, [1, 2, 3] as const]]) });
    assert.equal(stage.mriAppearance.at(-1), false, 'a paint replaces the scan');
    engine.present({ lang: 'en', referenceOnly: true });
    engine.model.setPaint(null);
    engine.present({ lang: 'en', referenceOnly: false });
    assert.equal(stage.mriAppearance.at(-1), true);
    engine.dispose();
  });
});
