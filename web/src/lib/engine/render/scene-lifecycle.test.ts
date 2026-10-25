import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { createScene } from './scene.ts';

// Only the renderer is replaced, since it needs a GL context.
const calls = vi.hoisted(() => ({ order: [] as string[], canvas: null as EventTarget | null }));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      setAttribute() {},
      remove() {},
      ownerDocument: new EventTarget(),
      getRootNode: () => new EventTarget(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    ratio = 1;
    toneMapping = 0;
    constructor() {
      calls.canvas = this.domElement;
    }
    getContext = () => null;
    setPixelRatio = (ratio: number) => {
      this.ratio = ratio;
    };
    getPixelRatio = () => this.ratio;
    setSize() {}
    initRenderTarget() {}
    setAnimationLoop() {}
    dispose() {
      calls.order.push('dispose');
    }
    forceContextLoss() {
      calls.order.push('forceContextLoss');
    }
  }
  return { ...original, WebGLRenderer: FakeRenderer };
});

const host = {
  prepend() {},
  getBoundingClientRect: () => ({ width: 800, height: 600 }),
} as unknown as HTMLElement;

describe('scene lifecycle', () => {
  beforeEach(() => {
    calls.order = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('document', { documentElement: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frees the renderer, then releases its context, without reporting a loss', () => {
    const onContextLost = vi.fn();
    const stage = createScene(host, { onContextLost });
    stage.dispose();
    assert.deepEqual(calls.order, ['dispose', 'forceContextLoss']);
    calls.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.equal(onContextLost.mock.calls.length, 0);
  });

  it('reports a context lost while the scene is alive', () => {
    const onContextLost = vi.fn();
    const stage = createScene(host, { onContextLost });
    calls.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.equal(onContextLost.mock.calls.length, 1);
    stage.dispose();
  });

  it('refuses a theme without a numeric exposure', () => {
    const stage = createScene(host);
    for (const exposure of ['', 'bright']) {
      vi.stubGlobal('getComputedStyle', () => ({
        getPropertyValue: (name: string) => (name === '--scene-exposure' ? exposure : '#808080'),
      }));
      assert.throws(() => stage.applyTheme(), /--scene-exposure/);
    }
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1.2' : '#808080'),
    }));
    assert.doesNotThrow(() => stage.applyTheme());
    stage.dispose();
  });
});
