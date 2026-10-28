import type { Language, Region } from '../../types/index.ts';

/**
 * Receptor densities measured by autoradiography in post-mortem brains
 * (`manifest.receptor_fingerprints` file): one fingerprint per EBRAINS dataset,
 * carried to the regions named after what it was measured in, never measured in
 * the anatomy shown.
 */

/** A receptor's symbol: text, with `{sub}` parts set as subscripts. */
export type SymbolPart = string | { sub: string };

export interface Receptor {
  id: string;
  display: SymbolPart[];
  aliases?: string[];
}

export interface Transmitter {
  id: string;
  name: string;
  name_fr: string;
  receptors: Receptor[];
}

/** Mean and SD over the sampled hemispheres; a null SD was not published or is withheld. */
export interface Density {
  mean: number;
  sd: number | null;
}

export interface Withheld {
  dataset: string;
  receptor: string;
  field: 'sd';
  published: number;
  reason: string;
  reason_fr: string;
}

export interface Fingerprint {
  key: string;
  measured_in: string;
  /** The part of an area sampled in two parts, or null. */
  part: 'dorsal' | 'ventral' | null;
  doi: string;
  documented_by: string[];
  receptors: Record<string, Density>;
  donors: { id: string; sex: string; age_years: number }[];
  hemispheres: { left: number; right: number };
}

export interface ReceptorFingerprints {
  id: 'receptor-fingerprints';
  unit: string;
  sources: Record<string, { short: string; citation: string; doi: string; pmid: number }>;
  transmitters: Transmitter[];
  withheld: Withheld[];
  datasets: Fingerprint[];
  /** Region id → the keys of the fingerprints it takes, one per part. */
  regions: Record<string, string[]>;
}

/** One measured receptor of a fingerprint, its bar a share of the highest mean published for it. */
export interface ReceptorRow {
  receptor: Receptor;
  density: Density;
  share: number;
  withheld: Withheld | null;
}

/** The published fingerprints, checked against the regions they name. */
export function validateReceptorFingerprints(
  data: ReceptorFingerprints,
  regions: ReadonlyMap<string, Region>,
): ReceptorFingerprints {
  if (
    data?.id !== 'receptor-fingerprints' ||
    !data.unit ||
    !Array.isArray(data.transmitters) ||
    !Array.isArray(data.datasets) ||
    !data.regions
  ) {
    throw new Error('Invalid receptor fingerprints.');
  }
  const receptors = new Set(data.transmitters.flatMap((t) => t.receptors.map((r) => r.id)));
  const keys = new Set<string>();
  for (const fingerprint of data.datasets) {
    const densities = Object.entries(fingerprint.receptors ?? {});
    if (
      !fingerprint.key ||
      keys.has(fingerprint.key) ||
      !fingerprint.measured_in ||
      !fingerprint.doi?.startsWith('https://doi.org/') ||
      !fingerprint.donors?.length ||
      !densities.length ||
      densities.some(
        ([id, { mean, sd }]) => !receptors.has(id) || !(mean > 0) || (sd !== null && !(sd >= 0)),
      ) ||
      fingerprint.documented_by.some((source) => !data.sources[source])
    ) {
      throw new Error(`Invalid receptor fingerprint: ${fingerprint.key}`);
    }
    keys.add(fingerprint.key);
  }
  for (const value of data.withheld) {
    const fingerprint = data.datasets.find((candidate) => candidate.key === value.dataset);
    if (
      value.field !== 'sd' ||
      fingerprint?.receptors[value.receptor]?.sd !== null ||
      !value.reason ||
      !value.reason_fr
    ) {
      throw new Error(`Invalid withheld value: ${value.dataset} ${value.receptor}`);
    }
  }
  for (const [id, taken] of Object.entries(data.regions)) {
    const parts = taken.map((key) => data.datasets.find((f) => f.key === key)?.part).sort();
    if (
      !regions.has(id) ||
      !taken.length ||
      taken.some((key) => !keys.has(key)) ||
      // One fingerprint, or exactly one per part.
      (taken.length > 1 && (parts.length !== 2 || parts[0] !== 'dorsal' || parts[1] !== 'ventral'))
    ) {
      throw new Error(`Invalid receptor-fingerprint assignment: ${id}`);
    }
  }
  return data;
}

/** The fingerprints a region takes, in published order: none, one, or one per part. */
export function fingerprintsOf(
  data: ReceptorFingerprints | null | undefined,
  regionId: string,
): Fingerprint[] {
  const keys = data?.regions[regionId] ?? [];
  return keys.map((key) => data!.datasets.find((fingerprint) => fingerprint.key === key)!);
}

/** Each receptor's highest published mean: the full length of its bar. */
function highestMeans(data: ReceptorFingerprints): Map<string, number> {
  const highest = new Map<string, number>();
  for (const fingerprint of data.datasets) {
    for (const [id, { mean }] of Object.entries(fingerprint.receptors)) {
      highest.set(id, Math.max(highest.get(id) ?? 0, mean));
    }
  }
  return highest;
}

/** A fingerprint's measured receptors by transmitter, in display order; a transmitter with none is left out. */
export function fingerprintGroups(
  data: ReceptorFingerprints,
  fingerprint: Fingerprint,
): { transmitter: Transmitter; rows: ReceptorRow[] }[] {
  const highest = highestMeans(data);
  return data.transmitters
    .map((transmitter) => ({
      transmitter,
      rows: transmitter.receptors
        .filter((receptor) => fingerprint.receptors[receptor.id])
        .map((receptor) => {
          const density = fingerprint.receptors[receptor.id]!;
          return {
            receptor,
            density,
            share: density.mean / highest.get(receptor.id)!,
            withheld:
              data.withheld.find(
                (value) => value.dataset === fingerprint.key && value.receptor === receptor.id,
              ) ?? null,
          };
        }),
    }))
    .filter((group) => group.rows.length);
}

/** The catalog's receptors this fingerprint did not measure, in display order. */
export function unmeasured(data: ReceptorFingerprints, fingerprint: Fingerprint): Receptor[] {
  return data.transmitters
    .flatMap((transmitter) => transmitter.receptors)
    .filter((receptor) => !fingerprint.receptors[receptor.id]);
}

/** A receptor's symbol as plain text, subscripts inline: what a list or a reader names it by. */
export const receptorText = (receptor: Receptor): string =>
  receptor.display.map((part) => (typeof part === 'string' ? part : part.sub)).join('');

export const transmitterName = (transmitter: Transmitter, lang: Language): string =>
  lang === 'fr' ? transmitter.name_fr : transmitter.name;
