import type { ClinicalAssociation } from '../core/clinical/types.ts';
import { findingsPaint, rankFindings } from '../core/lesion/findings.ts';
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

const tenth = (value: number) => Math.round(value * 10) / 10;

/**
 * The placed lesion: what the stage draws and where a click places it, its measurement and tract
 * count, each answered only for the placement that asked, and the findings near it.
 */
export function createLesionStore({
  lesion,
  associations,
}: {
  lesion: EngineLesion;
  associations: readonly ClinicalAssociation[];
}) {
  let sphere = $state.raw<LesionSphere | null>(null);
  let radius = $state<number>(LESION_RADIUS.initial);
  let placing = $state(false);
  let measured = $state.raw<Measured | null>(null);
  let counted = $state.raw<Counted>({ status: 'idle' });
  let painted = $state(false);
  // Once the reader has asked for the tracts, each later placement counts them too.
  let tractsWanted = false;
  let request = 0;

  const findings = $derived(
    measured?.status === 'ready' ? rankFindings(associations, measured.measurement.regions) : null,
  );
  const paint = $derived.by((): LesionPaint | null => {
    if (!painted || !findings || !sphere) return null;
    const { findings: coloured, paint } = findingsPaint(
      findings.shown,
      `${sphere.centre.join(',')}:${sphere.radius}`,
    );
    return {
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
    get painted() {
      return painted;
    },
    /** The findings on the brain, while the reader has asked for them. */
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
    setPainted(next: boolean): void {
      painted = next;
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
      painted = false;
      tractsWanted = false;
    },
  };
}

export type LesionStore = ReturnType<typeof createLesionStore>;
