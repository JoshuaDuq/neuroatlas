import type { Manifest } from '../../types/index.ts';
import type {
  CabNpData,
  DomainsData,
  Engine,
  EngineComparison,
  EngineEvents,
  FunctionalRegionsData,
  MriDisplay,
  Presentation,
  Rect,
  Size,
} from '../api.ts';
import { createFakeCamera } from './camera.ts';
import { createFakeModel } from './model.ts';
import type { FakeModel } from './model.ts';
import { createFakeSections } from './sections.ts';
import { canvasElement, createEvents, recorded } from './support.ts';
import type { Call } from './support.ts';
import { createFakeTracts } from './tracts.ts';
import type { FakeBundle, FakeTracts } from './tracts.ts';

export type { Call } from './support.ts';
export type { FakeMriNavigator } from './mri.ts';
export type { FakeBundle, FakeTracts } from './tracts.ts';

export interface FakeEngineOptions {
  /** The published manifest to serve, e.g. `public/models/cdmd/manifest.json`. */
  manifest: Manifest;
  cabNp?: CabNpData;
  functionalRegions?: FunctionalRegionsData;
  domains?: DomainsData;
  /** The stage canvas; without one, `canvas` and `captureSnapshot` need a DOM to create it. */
  canvas?: HTMLCanvasElement;
  hostSize?: Size;
  mri?: MriDisplay;
  /** The anatomy the tracts belong to, when it is not the manifest's own. */
  tractAnatomy?: string;
  tractBundles?: FakeBundle[];
}

export interface FakeEngine extends Engine {
  readonly model: FakeModel;
  readonly tracts: FakeTracts;
  /** Every call into the engine's domains, in order. Events and getters are not recorded. */
  readonly calls: readonly Call[];
  /** What the comparison overlay shows: the highlighted overlap and whether it is visible. */
  readonly highlighted: string | null;
  /** The last `present()` argument. */
  readonly presented: Presentation | null;
  /** Deliver an event the real engine would raise from the GPU or the pointer: `pick`, `hover`, `contextLost`. */
  emit<K extends keyof EngineEvents>(type: K, event: EngineEvents[K]): void;
}

/**
 * The engine contract, in memory: no WebGL, no DOM beyond an optional canvas. State, controller and panel
 * code run against it end to end. It keeps the real validation and the real event order, records calls, and
 * draws nothing. Tests drive the events only the GPU or the pointer would raise through `emit`.
 */
export function createFakeEngine(options: FakeEngineOptions): FakeEngine {
  const events = createEvents();
  const calls: Call[] = [];
  const hostSize = options.hostSize ?? { width: 1000, height: 700 };
  let disposed = false;
  let highlighted: string | null = null;
  let presented: Presentation | null = null;
  let overlayVisible = true;
  let overlapRequest = 0;

  // Declared first, assigned below: each domain reads the others only inside its methods.
  const sectionsRef: { current?: ReturnType<typeof createFakeSections> } = {};
  const model = createFakeModel({
    manifest: options.manifest,
    cabNp: options.cabNp,
    functionalRegions: options.functionalRegions,
    domains: options.domains,
    changed: () => {
      if (disposed || !sectionsRef.current) return;
      events.emit('change', { model: model.state, sections: sectionsRef.current.state });
    },
  });
  const sections = createFakeSections({
    model,
    mri: options.mri,
    changed: () => events.emit('change', { model: model.state, sections: sections.state }),
  });
  sectionsRef.current = sections;
  const camera = createFakeCamera({ model, sections, emit: events.emit, hostSize });
  const tracts = createFakeTracts({
    anatomy: options.manifest.anatomy.id,
    tractAnatomy: options.tractAnatomy,
    bundles: options.tractBundles,
    emit: events.emit,
  });

  const comparison: EngineComparison = {
    async highlight(id) {
      const request = ++overlapRequest;
      await Promise.resolve();
      if (request !== overlapRequest) return false;
      highlighted = id;
      return true;
    },
    clear() {
      overlapRequest++;
      highlighted = null;
    },
    setVisible(visible) {
      overlayVisible = visible;
    },
  };

  return {
    on: events.on,
    emit: events.emit,
    get canvas() {
      return (options.canvas ??= canvasElement());
    },
    model: recorded('model', model, calls),
    sections: recorded('sections', sections, calls),
    camera: recorded('camera', camera, calls),
    comparison: recorded('comparison', comparison, calls),
    tracts: recorded('tracts', tracts, calls),
    calls,
    get highlighted() {
      return overlayVisible ? highlighted : null;
    },
    get presented() {
      return presented;
    },

    applyTheme(theme) {
      calls.push({ domain: 'engine', method: 'applyTheme', args: [theme] });
    },
    present(presentation) {
      calls.push({ domain: 'engine', method: 'present', args: [presentation] });
      presented = presentation;
    },
    invalidate() {
      calls.push({ domain: 'engine', method: 'invalidate', args: [] });
    },
    captureSnapshot(crop?: Rect) {
      calls.push({ domain: 'engine', method: 'captureSnapshot', args: [crop] });
      const canvas = canvasElement();
      const rect = crop ?? { x: 0, y: 0, ...camera.hostSize };
      canvas.width = rect.width;
      canvas.height = rect.height;
      return { canvas, ratio: 1 };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      model.dispose();
    },
  };
}
