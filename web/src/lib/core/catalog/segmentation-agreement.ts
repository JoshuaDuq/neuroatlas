import type { Region } from '../../types/index.ts';

/**
 * Where NextBrain and aseg agree on the structures validation compares, on aseg's 1 mm grid
 * (`manifest.segmentation_agreement` file). Neither segmentation is the reference.
 */
export interface ComparedStructure {
  /** The structure's value in the compared NextBrain volume. */
  code: number;
  structure: string;
  hemisphere: 'left' | 'right';
  aseg_label: number;
  /** The aseg structure, NextBrain's union of it, and the NextBrain labels in that union. */
  regions: { aseg: string; learning: string; nextbrain: string[] };
  voxels: { both: number; aseg_only: number; nextbrain_only: number };
}

export interface SegmentationAgreement {
  id: 'segmentation-agreement';
  voxel_volume_mm3: number;
  structures: ComparedStructure[];
}

export type AgreementCategory = 'both' | 'aseg-only' | 'nextbrain-only';

export const AGREEMENT_CATEGORIES: readonly AgreementCategory[] = [
  'both',
  'aseg-only',
  'nextbrain-only',
];

/**
 * The linked MRI's ink for each category: a neutral wash where both agree, and a magenta and an
 * orange that stay apart under the common colour-vision deficiencies and from the crosshair's cyan.
 */
export const AGREEMENT_COLORS: Readonly<
  Record<AgreementCategory, readonly [number, number, number]>
> = {
  both: [236, 236, 236],
  'aseg-only': [235, 70, 210],
  'nextbrain-only': [255, 150, 30],
};

/** The published comparison, checked against the regions it names. */
export function validateSegmentationAgreement(
  agreement: SegmentationAgreement,
  regions: ReadonlyMap<string, Region>,
): SegmentationAgreement {
  if (
    agreement?.id !== 'segmentation-agreement' ||
    !(agreement.voxel_volume_mm3 > 0) ||
    !Array.isArray(agreement.structures) ||
    !agreement.structures.length
  ) {
    throw new Error('Invalid segmentation agreement.');
  }
  const codes = new Set<number>();
  for (const item of agreement.structures) {
    const { code, hemisphere, regions: named, voxels } = item;
    const sided = [named.aseg, named.learning, ...named.nextbrain].map((id) => regions.get(id));
    if (
      !Number.isInteger(code) ||
      code <= 0 ||
      code > 255 ||
      codes.has(code) ||
      regions.get(named.aseg)?.atlas !== 'aseg' ||
      regions.get(named.aseg)?.source_label_id !== item.aseg_label ||
      regions.get(named.learning)?.atlas !== 'learning' ||
      named.nextbrain.some((id) => regions.get(id)?.atlas !== 'nextbrain') ||
      sided.some((region) => region?.hemisphere !== hemisphere) ||
      ![voxels.both, voxels.aseg_only, voxels.nextbrain_only].every(
        (count) => Number.isInteger(count) && count >= 0,
      ) ||
      voxels.both + voxels.aseg_only + voxels.nextbrain_only === 0
    ) {
      throw new Error(`Invalid compared structure: ${item.structure} ${hemisphere}`);
    }
    codes.add(code);
  }
  return agreement;
}

/** The compared structure a region is, or belongs to; null for any other region. */
export function comparedStructureOf(
  agreement: SegmentationAgreement | null,
  regionId: string,
): ComparedStructure | null {
  return (
    agreement?.structures.find(
      ({ regions }) =>
        regions.aseg === regionId ||
        regions.learning === regionId ||
        regions.nextbrain.includes(regionId),
    ) ?? null
  );
}

export function agreementDice({ both, aseg_only, nextbrain_only }: ComparedStructure['voxels']) {
  return (2 * both) / (2 * both + aseg_only + nextbrain_only);
}

/** What a voxel is for a structure, from its aseg label and its compared NextBrain code. */
export function categoryAt(
  structure: Pick<ComparedStructure, 'code' | 'aseg_label'>,
  asegLabel: number,
  comparedCode: number,
): AgreementCategory | null {
  const aseg = asegLabel === structure.aseg_label;
  const nextbrain = comparedCode === structure.code;
  if (aseg && nextbrain) return 'both';
  if (aseg) return 'aseg-only';
  return nextbrain ? 'nextbrain-only' : null;
}
