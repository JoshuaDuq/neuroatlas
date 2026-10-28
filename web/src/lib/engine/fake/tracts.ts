import type { EngineTracts, TractBundle } from '../api.ts';
import { createFakeMriNavigator } from './mri.ts';
import type { FakeMriNavigator } from './mri.ts';
import type { Emit } from './support.ts';

export interface FakeBundle {
  id: string;
  name: Record<string, string>;
  /** Shown on first load, as the catalog's `initial` (native-viewer.js:88). */
  initial?: boolean;
}

export interface FakeTractsOptions {
  /** The anatomy on screen. */
  anatomy: string;
  /** The anatomy the tracts belong to; when it differs, the tracts are an independent reference. */
  tractAnatomy?: string;
  bundles?: FakeBundle[];
  defaultOpacity?: number;
  emit: Emit;
}

export interface FakeTracts extends EngineTracts {
  /** The tract reference of another anatomy is shown (the `tractsActive` state). */
  readonly referenceActive: boolean;
  /** The navigators opened so far, newest last. */
  readonly navigators: readonly FakeMriNavigator[];
}

export const DEFAULT_BUNDLES: FakeBundle[] = [
  { id: 'arcuate-left', name: { en: 'Arcuate · left', fr: 'Arqué · gauche' }, initial: true },
  { id: 'arcuate-right', name: { en: 'Arcuate · right', fr: 'Arqué · droit' }, initial: true },
  { id: 'cingulum-left', name: { en: 'Cingulum · left', fr: 'Cingulum · gauche' } },
  { id: 'cingulum-right', name: { en: 'Cingulum · right', fr: 'Cingulum · droit' } },
];

/** Four streamlines per bundle, so a minimum length visibly thins the set. */
const LENGTHS = [20, 40, 60, 80];

/**
 * In-memory stand-in for the native tract viewer: bundles load at once, visibility and the minimum
 * length are real state, and the summaries are computed from four fixed streamline lengths.
 */
export function createFakeTracts({
  anatomy,
  tractAnatomy = anatomy,
  bundles = DEFAULT_BUNDLES,
  defaultOpacity = 0.16,
  emit,
}: FakeTractsOptions): FakeTracts {
  const catalog = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const loaded = new Map<string, boolean>();
  const navigators: FakeMriNavigator[] = [];
  let ready = false;
  let active = false;
  let referenceActive = false;
  let minimum = 1;
  let overlay = false;

  const summary = (id: string): TractBundle => {
    const bundle = catalog.get(id)!;
    const kept = LENGTHS.filter((length) => length >= minimum);
    return {
      id,
      catalogId: id,
      name: bundle.name.en!,
      label: bundle.name,
      file: `${id}.trk`,
      visible: loaded.get(id)!,
      total: LENGTHS.length,
      shown: kept.length,
      mean: kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : null,
      min: kept.length ? Math.min(...kept) : null,
      max: kept.length ? Math.max(...kept) : null,
    };
  };

  async function loadBundle(id: string) {
    const bundle = catalog.get(id);
    if (!bundle) throw new RangeError(`Unknown tract bundle: ${id}`);
    loaded.set(id, true);
    emit('tractsVisibility', undefined);
  }

  return {
    anatomy: tractAnatomy,
    get referenceActive() {
      return referenceActive;
    },
    get ready() {
      return ready;
    },
    get streamlinesVisible() {
      return (
        ready && (anatomy === tractAnatomy ? overlay : active) && [...loaded.values()].some(Boolean)
      );
    },
    defaultOpacity,
    get navigators() {
      return navigators;
    },
    snapshot: () => [...loaded.keys()].map(summary),
    hasBundle: (id) => loaded.has(id),

    async setActive(next) {
      active = next;
      const nextReference = next && anatomy !== tractAnatomy;
      if (nextReference !== referenceActive) {
        referenceActive = nextReference;
        emit('tractsActive', { active: referenceActive });
      }
      if (next && !ready) {
        for (const bundle of bundles.filter((entry) => entry.initial)) loaded.set(bundle.id, true);
        ready = true;
        emit('tractsReady', undefined);
      }
    },
    loadBundle,
    setVisible(id, visible) {
      if (!loaded.has(id)) throw new RangeError(`Unknown tract bundle: ${id}`);
      loaded.set(id, visible);
      emit('tractsVisibility', undefined);
    },
    setMinimum(value) {
      minimum = value;
    },
    setOutlineOpacity(opacity) {
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new RangeError('Brain opacity must be between 0 and 1.');
      }
    },
    setOverlay(visible) {
      overlay = visible;
      emit('tractsVisibility', undefined);
    },
    // The surface sits off the scanner, so a caller that skips the conversion is caught.
    scannerToSurface: ([x, y, z]) => [x + 1, y - 2, z + 3],
    surfaceToScanner: ([x, y, z]) => [x - 1, y + 2, z - 3],
    async createMriNavigator(_canvas, onLocation) {
      // The decode the 3D lines share (tract-file.js:12); it changes nothing that is drawn.
      const decode = async (id: string) => {
        if (!catalog.has(id)) throw new RangeError(`Unknown MRI tract bundle: ${id}`);
      };
      const navigator = createFakeMriNavigator(onLocation, decode);
      navigators.push(navigator);
      return navigator;
    },
  };
}
