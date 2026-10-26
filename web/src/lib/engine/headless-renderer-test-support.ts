import type * as Three from 'three';

/**
 * The real engine without a GL context, for the unit project. Only the renderer is replaced (it needs a
 * GL context) and the composer's draw is silenced; the scene, the model, the cut, the tracts and the
 * facade are the real ones. The animation loop is the test's to turn.
 */

/** What the replaced renderer reports to the test that mocked it. */
export interface HeadlessProbe {
  attributes: Map<string, string>;
  rendererDisposed: number;
  loop: ((now: number) => void) | null;
}

/** The module `vi.mock('three', …)` answers with: three.js whose renderer draws nothing. */
export function withHeadlessRenderer(original: typeof Three, probe: HeadlessProbe): typeof Three {
  class HeadlessRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      setAttribute(name: string, value: string) {
        probe.attributes.set(name, value);
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
    setAnimationLoop = (loop: ((now: number) => void) | null) => {
      probe.loop = loop;
    };
    dispose() {
      probe.rendererDisposed++;
    }
    forceContextLoss() {}
  }
  return { ...original, WebGLRenderer: HeadlessRenderer } as unknown as typeof Three;
}
