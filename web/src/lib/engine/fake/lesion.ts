import { lesionBundles } from '../../core/lesion/tracts.ts';
import type { EngineLesion, LesionMeasurement, LesionSphere } from '../api.ts';

export interface FakeLesion extends EngineLesion {
  /** What the stage draws, and whether a click places it. */
  readonly shown: LesionSphere | null;
  readonly placing: boolean;
  /** The bundle whose crossing streamlines are drawn alone. */
  readonly shownTract: { id: string; sphere: LesionSphere } | null;
}

const EMPTY: LesionMeasurement = {
  volume: 0,
  tissue: { cortex: 0, white: 0, deep: 0, fluid: 0, outside: 0 },
  regions: new Map(),
  sizes: new Map(),
  centre: { tissue: 'outside', region: null },
  tissueOf: new Map(),
};

function requireRadius({ radius }: LesionSphere): void {
  if (!(Number.isFinite(radius) && radius > 0)) {
    throw new RangeError(
      `A lesion radius must be a positive number of millimetres, not ${radius}.`,
    );
  }
}

/**
 * The lesion with no volumes: it keeps the real validation and the real choice of bundles, answers a
 * measurement a test supplies, and counts every streamline as missed.
 */
export function createFakeLesion({
  bundles,
  measurement = EMPTY,
}: {
  /** The anatomy's own bundles, or null when its tracts are another subject's. */
  bundles: readonly { id: string }[] | null;
  measurement?: LesionMeasurement;
}): FakeLesion {
  let shown: LesionSphere | null = null;
  let placing = false;
  let shownTract: FakeLesion['shownTract'] = null;
  const lesion: FakeLesion = {
    get shown() {
      return shown;
    },
    get placing() {
      return placing;
    },
    get shownTract() {
      return shownTract;
    },
    show(sphere) {
      if (sphere) requireRadius(sphere);
      shown = sphere;
    },
    setPlacing(next) {
      placing = next;
    },
    async measure(sphere) {
      requireRadius(sphere);
      return measurement;
    },
    tractBundles(sphere) {
      requireRadius(sphere);
      return bundles ? lesionBundles(bundles, sphere) : [];
    },
    async measureTracts(sphere, onBundle) {
      const ids = lesion.tractBundles(sphere);
      return ids.map((id, index) => {
        onBundle?.(index + 1, ids.length);
        return { id, crossing: 0, total: 4 };
      });
    },
    async showTract(id, sphere) {
      requireRadius(sphere);
      if (!bundles?.some((bundle) => bundle.id === id)) {
        throw new RangeError(`Unknown tract bundle: ${id}`);
      }
      shownTract = { id, sphere };
    },
    clearTract() {
      shownTract = null;
    },
  };
  return lesion;
}
