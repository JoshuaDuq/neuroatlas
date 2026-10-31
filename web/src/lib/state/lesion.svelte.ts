import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalAssociation } from '../core/clinical/types.ts';
import type { Coordinate } from '../core/coordinates/parse.ts';
import { SLIGHT_SHARE, findingsPaint, rankFindings } from '../core/lesion/findings.ts';
import { functionReach, functionsPaint, lesionProfile } from '../core/lesion/functions.ts';
import type { LesionPaint } from '../core/state/paint.ts';
import { LESION_RADIUS } from '../types/constants.ts';
import type { LESION_MODES } from '../types/constants.ts';
import type {
  EngineLesion,
  LesionMeasurement,
  LesionSphere,
  TractCrossing,
  Vec3,
} from '../engine/api.ts';

export type Measured =
  | { status: 'measuring' }
  | { status: 'ready'; measurement: LesionMeasurement }
  | { status: 'error'; error: unknown };

export type Counted =
  | { status: 'idle' }
  | { status: 'counting'; counted: number; total: number }
  | { status: 'ready'; crossings: TractCrossing[] }
  | { status: 'error'; error: unknown };

/** The one bundle whose crossing streamlines are drawn alone, as the engine has answered it. */
export type TractView =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; error: unknown };

export type LesionMode = (typeof LESION_MODES)[number];

/** A published coordinate the sphere marks: the numbers as entered, and the space chosen for them. */
export interface PlacedCoordinate {
  entered: Coordinate;
  /** A published space's id, or `unstated`. */
  space: string;
}

const tenth = (value: number) => Math.round(value * 10) / 10;

/**
 * The placed lesion: what the stage draws and where a click places it, its measurement and tract
 * count, each answered only for the placement that asked, and the functions and findings near it.
 * The one sphere may instead mark a published coordinate, at its own fixed radius; placing either
 * replaces the other.
 */
export function createLesionStore({
  lesion,
  cortex,
  associations,
  domains,
  deficitGroup,
}: {
  lesion: EngineLesion;
  /** The cortex's opacity, and the see-through one the tracts are drawn under, as the Tracts tab does. */
  cortex: {
    readonly opacity: number;
    setOpacity(opacity: number): void;
    readonly seeThrough: number;
  };
  associations: readonly ClinicalAssociation[];
  domains: Pick<NeuropsychDomains, 'groups' | 'domains' | 'regions'>;
  deficitGroup: (deficit: string) => string;
}) {
  let sphere = $state.raw<LesionSphere | null>(null);
  let coordinate = $state.raw<PlacedCoordinate | null>(null);
  let radius = $state<number>(LESION_RADIUS.initial);
  let placing = $state(false);
  let measured = $state.raw<Measured | null>(null);
  let counted = $state.raw<Counted>({ status: 'idle' });
  let mode = $state<LesionMode>('lesion');
  let selectedTract = $state<string | null>(null);
  let tractView = $state.raw<TractView>({ status: 'idle' });
  let viewRequest = 0;
  // The opacity an opaque cortex had before the streamlines made it see-through.
  let heldOpacity: number | null = null;
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
          if (ask !== request) return;
          counted = { status: 'ready', crossings };
          // A bundle the lesion no longer crosses has nothing left to draw.
          const drawn = crossings.some(({ id, crossing }) => id === selectedTract && crossing > 0);
          if (selectedTract !== null && !drawn) clearTract();
        },
        (error: unknown) => {
          if (ask !== request) return;
          counted = { status: 'error', error };
          console.error(error);
        },
      );
  }

  function showTract(id: string, current: LesionSphere): void {
    const ask = ++viewRequest;
    // Following the sphere keeps the bundle's lines up rather than flashing a load.
    if (selectedTract !== id || tractView.status === 'error') tractView = { status: 'loading' };
    selectedTract = id;
    if (heldOpacity === null && cortex.opacity === 1) {
      heldOpacity = cortex.opacity;
      cortex.setOpacity(cortex.seeThrough);
    }
    lesion.showTract(id, current).then(
      () => {
        if (ask === viewRequest) tractView = { status: 'ready' };
      },
      (error: unknown) => {
        if (ask !== viewRequest) return;
        tractView = { status: 'error', error };
        console.error(error);
      },
    );
  }

  function clearTract(): void {
    viewRequest++;
    selectedTract = null;
    tractView = { status: 'idle' };
    lesion.clearTract();
    // An opacity the reader chose since is theirs to keep.
    if (heldOpacity !== null && cortex.opacity === cortex.seeThrough)
      cortex.setOpacity(heldOpacity);
    heldOpacity = null;
  }

  /** The selection follows the sphere while the sphere still reaches the bundle's side. */
  function follow(current: LesionSphere): void {
    if (selectedTract === null) return;
    if (lesion.tractBundles(current).includes(selectedTract)) showTract(selectedTract, current);
    else clearTract();
  }

  return {
    get sphere() {
      return sphere;
    },
    /** What the sphere is: a lesion, or a published coordinate. */
    get kind(): 'lesion' | 'coordinate' {
      return coordinate ? 'coordinate' : 'lesion';
    },
    /** The coordinate the sphere marks, or null for a lesion. */
    get coordinate() {
      return coordinate;
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
    /** The bundle whose crossing streamlines the stage draws alone, or null for the ordinary tracts. */
    get selectedTract() {
      return selectedTract;
    },
    get tractView() {
      return tractView;
    },
    /** The reader's own cortex opacity while the streamlines hold it see-through, for a link to carry. */
    get heldOpacity() {
      return heldOpacity;
    },
    /** The functions' territories or the findings' regions on the brain, as the mode asks. */
    get paint() {
      return paint;
    },
    place([right, anterior, superior]: Vec3): void {
      coordinate = null;
      sphere = { centre: [tenth(right), tenth(anterior), tenth(superior)], radius };
      measure(sphere);
      follow(sphere);
    },
    /** The slider moving: the stage follows, and the measurement waits for `commitRadius`. */
    previewRadius(next: number): void {
      radius = next;
      // A coordinate's radius is fixed; the slider is the next lesion's.
      if (!sphere || coordinate) return;
      sphere = { ...sphere, radius: next };
      follow(sphere);
    },
    commitRadius(next: number): void {
      radius = next;
      if (!sphere || coordinate) return;
      sphere = { ...sphere, radius: next };
      measure(sphere);
      follow(sphere);
    },
    /** Mark a published coordinate where it landed on this brain, in surface RAS millimetres. */
    placeCoordinate(
      placed: PlacedCoordinate,
      [right, anterior, superior]: Vec3,
      fixed: number,
    ): void {
      coordinate = placed;
      mode = 'lesion';
      sphere = { centre: [tenth(right), tenth(anterior), tenth(superior)], radius: fixed };
      measure(sphere);
      follow(sphere);
    },
    setPlacing(next: boolean): void {
      placing = next;
    },
    setMode(next: LesionMode): void {
      mode = next;
    },
    showTract(id: string): void {
      if (!sphere) throw new Error('Place a lesion before showing its streamlines.');
      showTract(id, sphere);
    },
    clearTract,
    /** A link's lesion: placed, coloured and, with a bundle, counted and drawn, as the reader left it. */
    restore(next: LesionSphere, nextMode: LesionMode, tract: string | null): void {
      radius = next.radius;
      coordinate = null;
      sphere = next;
      mode = nextMode;
      tractsWanted = tract !== null;
      if (selectedTract !== null && selectedTract !== tract) clearTract();
      measure(sphere);
      if (tract !== null) showTract(tract, sphere);
    },
    countTracts(): void {
      tractsWanted = true;
      if (sphere) count(sphere, request);
    },
    remove(): void {
      request++;
      sphere = null;
      coordinate = null;
      measured = null;
      counted = { status: 'idle' };
      mode = 'lesion';
      tractsWanted = false;
      if (selectedTract !== null) clearTract();
    },
  };
}

export type LesionStore = ReturnType<typeof createLesionStore>;
