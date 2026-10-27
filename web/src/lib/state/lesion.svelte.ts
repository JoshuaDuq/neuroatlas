import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalAssociation } from '../core/clinical/types.ts';
import { SLIGHT_SHARE, findingsPaint, rankFindings } from '../core/lesion/findings.ts';
import { functionReach, functionsPaint, lesionProfile } from '../core/lesion/functions.ts';
import type { LesionPaint } from '../core/state/paint.ts';
import type {
  EngineLesion,
  LesionMeasurement,
  LesionSphere,
  TractCrossing,
  Vec3,
} from '../engine/api.ts';

/** The radius slider, in millimetres. */
export const LESION_RADIUS = { min: 3, max: 30, initial: 10 } as const;

export type Measured =
  | { status: 'measuring' }
  | { status: 'ready'; measurement: LesionMeasurement }
  | { status: 'error'; error: unknown };

export type Counted =
  | { status: 'idle' }
  | { status: 'counting'; counted: number; total: number }
  | { status: 'ready'; crossings: TractCrossing[] }
  | { status: 'error'; error: unknown };

/** What colours the brain beside the lesion: nothing, its functions' territories, or its findings' regions. */
export type LesionMode = 'lesion' | 'functions' | 'deficits';

const tenth = (value: number) => Math.round(value * 10) / 10;

/**
 * The placed lesion: what the stage draws and where a click places it, its measurement and tract
 * count, each answered only for the placement that asked, and the functions and findings near it.
 */
export function createLesionStore({
  lesion,
  associations,
  domains,
  deficitGroup,
}: {
  lesion: EngineLesion;
  associations: readonly ClinicalAssociation[];
  domains: Pick<NeuropsychDomains, 'groups' | 'domains' | 'regions'>;
  deficitGroup: (deficit: string) => string;
}) {
  let sphere = $state.raw<LesionSphere | null>(null);
  let radius = $state<number>(LESION_RADIUS.initial);
  let placing = $state(false);
  let measured = $state.raw<Measured | null>(null);
  let counted = $state.raw<Counted>({ status: 'idle' });
  let mode = $state<LesionMode>('lesion');
  // Once the reader has asked for the tracts, each later placement counts them too.
  let tractsWanted = false;
  let request = 0;

  const measurement = $derived(measured?.status === 'ready' ? measured.measurement : null);
  const findings = $derived(measurement && rankFindings(associations, measurement.regions));
  const functions = $derived.by(() => {
    if (!measurement) return null;
    const reach = functionReach(domains, measurement.regions, measurement.sizes);
    return {
      shown: reach.filter((row) => row.share >= SLIGHT_SHARE),
      slight: reach.filter((row) => row.share < SLIGHT_SHARE),
    };
  });
  const profile = $derived(
    findings &&
      functions &&
      lesionProfile(
        domains.groups.map((group) => group.id),
        functions.shown,
        findings.shown,
        deficitGroup,
      ),
  );
  const names = new Map(domains.domains.map((row) => [row.id, { en: row.name, fr: row.name_fr }]));
  const paint = $derived.by((): LesionPaint | null => {
    if (mode === 'lesion' || !findings || !functions || !sphere) return null;
    const key = `${sphere.centre.join(',')}:${sphere.radius}`;
    if (mode === 'functions') {
      const { paint, rows } = functionsPaint(domains, functions.shown, key);
      return {
        kind: 'functions',
        paint,
        rows: rows.map(({ id, color }) => ({ id, color, title: names.get(id)! })),
      };
    }
    const { findings: coloured, paint } = findingsPaint(findings.shown, key);
    return {
      kind: 'deficits',
      paint,
      rows: coloured.flatMap(({ finding, color }) =>
        color ? [{ id: finding.association.id, color, title: finding.association.title }] : [],
      ),
    };
  });

  const bundles = $derived(sphere ? lesion.tractBundles(sphere) : []);

  $effect(() => lesion.show(sphere));
  $effect(() => lesion.setPlacing(placing));

  function measure(current: LesionSphere): void {
    const ask = ++request;
    measured = { status: 'measuring' };
    lesion.measure(current).then(
      (measurement) => {
        if (ask === request) measured = { status: 'ready', measurement };
      },
      (error: unknown) => {
        if (ask !== request) return;
        measured = { status: 'error', error };
        console.error(error);
      },
    );
    counted = { status: 'idle' };
    if (tractsWanted) count(current, ask);
  }

  function count(current: LesionSphere, ask: number): void {
    counted = { status: 'counting', counted: 0, total: lesion.tractBundles(current).length };
    lesion
      .measureTracts(current, (done, total) => {
        if (ask === request) counted = { status: 'counting', counted: done, total };
      })
      .then(
        (crossings) => {
          if (ask === request) counted = { status: 'ready', crossings };
        },
        (error: unknown) => {
          if (ask !== request) return;
          counted = { status: 'error', error };
          console.error(error);
        },
      );
  }

  return {
    get sphere() {
      return sphere;
    },
    get radius() {
      return radius;
    },
    get placing() {
      return placing;
    },
    get measured() {
      return measured;
    },
    get counted() {
      return counted;
    },
    /** The tract bundles a count would download, for the anatomy's own tracts. */
    get bundles() {
      return bundles;
    },
    get findings() {
      return findings;
    },
    /** The functions whose territories it reaches, those under 1% apart. */
    get functions() {
      return functions;
    },
    /** The functions and deficits it reaches, by the groups the two tabs share. */
    get profile() {
      return profile;
    },
    get mode() {
      return mode;
    },
    /** The functions' territories or the findings' regions on the brain, as the mode asks. */
    get paint() {
      return paint;
    },
    place([right, anterior, superior]: Vec3): void {
      sphere = { centre: [tenth(right), tenth(anterior), tenth(superior)], radius };
      measure(sphere);
    },
    /** The slider moving: the stage follows, and the measurement waits for `commitRadius`. */
    previewRadius(next: number): void {
      radius = next;
      if (sphere) sphere = { ...sphere, radius: next };
    },
    commitRadius(next: number): void {
      radius = next;
      if (!sphere) return;
      sphere = { ...sphere, radius: next };
      measure(sphere);
    },
    setPlacing(next: boolean): void {
      placing = next;
    },
    setMode(next: LesionMode): void {
      mode = next;
    },
    countTracts(): void {
      tractsWanted = true;
      if (sphere) count(sphere, request);
    },
    remove(): void {
      request++;
      sphere = null;
      measured = null;
      counted = { status: 'idle' };
      mode = 'lesion';
      tractsWanted = false;
    },
  };
}

export type LesionStore = ReturnType<typeof createLesionStore>;
