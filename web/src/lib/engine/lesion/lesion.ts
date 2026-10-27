import type { Mesh, Plane } from 'three';
import { lesionBundles } from '../../core/lesion/tracts.ts';
import type { Region } from '../../types/index.ts';
import type { EngineLesion, LesionMeasurement, LesionSphere, TractCrossing } from '../api.ts';
import type { TissueAtlasRecord, TissueMetadata } from '../tissues/gpu-sections.ts';
import { loadVolume as loadPublishedVolume } from '../slices/volume.ts';
import type { Volume, VolumeFile } from '../slices/volume.ts';
import { createLesionMarking } from './marking.ts';
import { labelTotals, regionsInSphere, tissueInSphere } from './measure.ts';
import type { MeasuredLabel, RegionShares } from './measure.ts';

/** aparc.a2009s+aseg: FreeSurfer's own tissue labels, which the tissue composition is read from. */
const TISSUE_ATLAS = 'destrieux';

export interface LesionOptions {
  model: {
    readonly visibleMeshes: readonly Mesh[];
    readonly regions: ReadonlyMap<string, Region>;
    readonly clippingPlanes: readonly Plane[];
  };
  /** The published label tables, which the cut also reads. */
  tissues: { loadMetadata(): Promise<void>; readonly metadata: TissueMetadata | null };
  /** Where `tissue-labels.json`'s files resolve from. */
  baseUrl: string | URL;
  /** The anatomy's own tracts, or null when its tracts are another subject's. */
  tracts: {
    readonly bundles: readonly { id: string }[];
    crossing(
      sphere: LesionSphere,
      ids: readonly string[],
      onBundle?: (counted: number, total: number) => void,
    ): Promise<TractCrossing[]>;
  } | null;
  invalidate: () => void;
  /** Download and decode one label volume. */
  loadVolume?: (record: VolumeFile, baseUrl: string | URL) => Promise<Volume>;
}

interface Loaded {
  volume: Volume;
  labels: readonly MeasuredLabel[];
  totals: Map<number, number>;
}

function requireRadius({ radius }: LesionSphere): void {
  if (!(Number.isFinite(radius) && radius > 0)) {
    throw new RangeError(
      `A lesion radius must be a positive number of millimetres, not ${radius}.`,
    );
  }
}

/** The lesion domain: its marking on the stage, the clicks that place it, and its measurement. */
export function createLesion({
  model,
  tissues,
  baseUrl,
  tracts,
  invalidate,
  loadVolume = loadPublishedVolume,
}: LesionOptions) {
  const marking = createLesionMarking();
  const volumes = new Map<string, Promise<Loaded>>();
  let shown: LesionSphere | null = null;
  let placing = false;

  function load(id: string, record: VolumeFile & { labels: readonly MeasuredLabel[] }) {
    let loading = volumes.get(id);
    if (!loading) {
      loading = loadVolume(record, baseUrl).then((volume) => ({
        volume,
        labels: record.labels,
        totals: labelTotals(volume),
      }));
      volumes.set(id, loading);
      loading.catch(() => volumes.delete(id));
    }
    return loading;
  }

  const cortex = () =>
    model.visibleMeshes.filter((mesh) => {
      const kind = model.regions.get(mesh.userData['region_id'] as string)?.kind;
      return kind === 'cortex' || kind === 'non-region';
    });

  function redraw(): void {
    marking.show(shown, cortex(), model.clippingPlanes);
    invalidate();
  }

  const lesion: EngineLesion = {
    show(sphere) {
      if (sphere) requireRadius(sphere);
      shown = sphere;
      redraw();
    },
    setPlacing(next) {
      placing = next;
    },
    async measure(sphere) {
      requireRadius(sphere);
      await tissues.loadMetadata();
      const { atlases, white_matter: white } = tissues.metadata!;
      if (!atlases[TISSUE_ATLAS])
        throw new Error(`No ${TISSUE_ATLAS} label volume to measure tissue on.`);
      const atlasIds = Object.keys(atlases);
      const loaded = await Promise.all([
        ...atlasIds.map((id) => load(id, atlases[id] as TissueAtlasRecord)),
        ...(white ? [load('white-matter', whiteMatterRecord(white))] : []),
      ]);
      const regions: RegionShares = new Map();
      // Each atlas volume answers for its own regions; the cortex-free labels it shares (aseg) are
      // read once, from the tissue atlas. Gyral white matter is its own volume.
      const keep = (shares: RegionShares, prefixes: readonly string[]) => {
        for (const [id, share] of shares) {
          if (prefixes.includes(id.slice(0, id.indexOf(':')))) regions.set(id, share);
        }
      };
      atlasIds.forEach((id, index) => {
        const { volume, labels, totals } = loaded[index]!;
        const shares = regionsInSphere(volume, labels, sphere, totals);
        keep(shares, id === TISSUE_ATLAS ? [id, 'aseg'] : [id]);
      });
      if (white) {
        const { volume, labels, totals } = loaded.at(-1)!;
        keep(regionsInSphere(volume, labels, sphere, totals), ['wmparc']);
      }
      const tissue = loaded[atlasIds.indexOf(TISSUE_ATLAS)]!;
      const composition = tissueInSphere(tissue.volume, tissue.labels, sphere);
      const measurement: LesionMeasurement = {
        volume: Object.values(composition).reduce((sum, mm3) => sum + mm3, 0),
        tissue: composition,
        regions,
      };
      return measurement;
    },
    tractBundles(sphere) {
      requireRadius(sphere);
      return tracts ? lesionBundles(tracts.bundles, sphere) : [];
    },
    async measureTracts(sphere, onBundle) {
      const ids = lesion.tractBundles(sphere);
      if (!tracts) return [];
      return tracts.crossing(sphere, ids, onBundle);
    },
  };

  return {
    ...lesion,
    group: marking.group,
    get placing() {
      return placing;
    },
    /** The model's display changed: the footprint follows the cortex that is drawn and how it is cut. */
    refresh(): void {
      if (shown) redraw();
    },
    applyTheme: marking.applyTheme,
    dispose: marking.dispose,
  };
}

/** The white-matter record names no label but its region; the measurement reads only that. */
function whiteMatterRecord(
  record: NonNullable<TissueMetadata['white_matter']>,
): VolumeFile & { labels: readonly MeasuredLabel[] } {
  return {
    ...record,
    labels: record.labels.map(({ region_id }) => ({
      kind: 'tissue',
      region_id: region_id ?? null,
    })),
  };
}
