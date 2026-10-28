import { Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import type { BufferGeometry, Color } from 'three';
import { visibilityOf } from '../../core/catalog/visibility.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import type { Manifest } from '../../types/index.ts';
import type { DisplaySettings, Region } from '../../types/index.ts';
import type { CapLabelUniforms } from './cap-labels.ts';
import { addCapLabels } from './cap-labels.ts';
import { addBoundaryEdges } from './boundary-edges.ts';
import type { EdgeUniforms } from './boundary-edges.ts';
import { tissueColor } from '../render/materials.ts';
import type { Appearance } from '../render/materials.ts';
import { addMriAppearance } from '../render/mri-material.ts';
import type { MriUniforms } from '../render/mri-material.ts';
import {
  labelAppearance,
  usesAtlasColors,
  usesCabNpColors,
  usesTerritoryColors,
  usesNetworkColors,
  usesPaint,
} from './palette.ts';
import type { Label, PaletteLookup } from './palette.ts';
import { buildRibbonWedges } from './ribbon-wedges.ts';
import { createSolidMaterial } from './solid-material.ts';
import type { SolidAnatomy, SolidUserData } from './solid-material.ts';
import type { Band, SolidSource, SolidSections } from './solid-sections.ts';
import type { WhiteMatter } from './white-matter.ts';

type Side = 'left' | 'right';

/** What a cut source's `userData` says about the anatomy it stands for. */
interface CutSourceData {
  region_id?: string;
  hemisphere?: Region['hemisphere'];
  boundary?: 'pial' | 'white';
  kind?: string;
  atlas?: string;
  detail?: string;
  mri_registered?: boolean;
  [key: string]: unknown;
}

/** What a cap material carries on `userData`: `createSolidMaterial`'s uniforms and the label-sampling flag. */
export type CapUserData = Pick<SolidUserData, 'tissueVariation'> &
  Partial<SolidUserData> & { sampledLabels: { value: boolean } };

/** The registered MRI and cut labels the solids' materials read. */
export interface SolidSourceAnatomy extends SolidAnatomy {
  capLabels: CapLabelUniforms;
  capEdges: EdgeUniforms;
  mriUniforms: MriUniforms;
}

/** An atlas's `ribbon_labels` record in the manifest. */
interface RibbonLabelsRecord {
  file: string;
  vertex_counts: Record<Side, number>;
  region_ids: string[];
}

/** The cut labels indexed the two ways a solid can be identified. */
export interface LabelIndex {
  byRegion: Map<string, Label>;
  byCode: Map<number, Label>;
}

/** The display settings the painter reads. */
export type SolidPaintState = DisplaySettings;

/** The part of a solid `paintSolids` reads and writes. */
export interface PaintableSolid {
  source: {
    userData: CutSourceData;
    material?: unknown;
  };
  cap: { material: { color: Color; userData: CapUserData } };
  visible: boolean;
  region?: string | null;
}

const HEMISPHERES: readonly Side[] = ['left', 'right'];
const WHITE_MATTER = { left: 2, right: 41 };

/** Later bands cap over earlier ones where their solids overlap. */
export const BANDS = { envelope: 0, ribbon: 1, structure: 2 } as const satisfies Record<
  string,
  Band
>;

/**
 * A cut source for a mesh the model already holds. It shares the mesh's
 * geometry and BVH, which the model owns; `color` is the published colour a
 * nucleus cap takes under atlas colours.
 */
export function solidSource(
  mesh: Mesh,
  userData: Record<string, unknown> = { ...mesh.userData },
  color: Color | null = null,
): SolidSource {
  mesh.updateWorldMatrix(true, false);
  const source = new Mesh(mesh.geometry, new MeshBasicMaterial());
  if (color) source.material.color.copy(color);
  source.matrixAutoUpdate = false;
  source.matrix.copy(mesh.matrixWorld);
  source.matrixWorld.copy(mesh.matrixWorld);
  source.userData = userData;
  return source;
}

export function enclosingFirst<T extends { userData?: { segmentation_volume_mm3?: number } }>(
  sources: readonly T[],
): T[] {
  return [...sources].sort(
    (a, b) =>
      (b.userData?.['segmentation_volume_mm3'] ?? 0) -
      (a.userData?.['segmentation_volume_mm3'] ?? 0),
  );
}

function envelopeSurface(
  sources: readonly Mesh[],
  hemisphere: Side,
  boundary: 'pial' | 'white',
): { position: ArrayLike<number>; index: ArrayLike<number> } {
  const mesh = sources.find(
    (source) =>
      source.userData['hemisphere'] === hemisphere && source.userData['boundary'] === boundary,
  );
  if (!mesh) throw new Error(`Missing the ${hemisphere} ${boundary} envelope.`);
  mesh.updateWorldMatrix(true, false);
  const baked = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  return { position: baked.getAttribute('position').array, index: baked.getIndex()!.array };
}

/**
 * One closed solid per parcel of an atlas.
 *
 * The ribbon between the native envelopes is already published, so an atlas
 * adds only a region index per vertex. Cutting the parcel out of that ribbon
 * puts its boundary on the reconstruction rather than on the 1 mm label grid.
 */
export async function loadRibbonSources(
  manifest: Pick<Manifest, 'atlases'>,
  baseUrl: string | URL,
  atlas: string,
  envelopes: readonly Mesh[],
): Promise<Mesh<BufferGeometry>[]> {
  const record = manifest.atlases.find((entry) => entry.id === atlas)?.ribbon_labels as
    RibbonLabelsRecord | undefined;
  if (!record) return [];
  const bytes = await fetchAsset(new URL(record.file, baseUrl));
  const expected =
    (record.vertex_counts.left + record.vertex_counts.right) * Uint16Array.BYTES_PER_ELEMENT;
  if (bytes.byteLength !== expected) {
    throw new Error(
      `Ribbon labels for ${atlas} hold ${bytes.byteLength} bytes; the manifest publishes ${expected}.`,
    );
  }
  const published = new Uint16Array(bytes);
  const sources: Mesh<BufferGeometry>[] = [];
  let at = 0;
  for (const hemisphere of HEMISPHERES) {
    const count = record.vertex_counts[hemisphere];
    const labels = published.subarray(at, at + count);
    at += count;
    const pial = envelopeSurface(envelopes, hemisphere, 'pial');
    const white = envelopeSurface(envelopes, hemisphere, 'white');
    const wedges = buildRibbonWedges({
      faces: pial.index,
      pial: pial.position as Float32Array,
      white: white.position as Float32Array,
      labels,
    });
    for (const [index, geometry] of wedges) {
      const mesh = new Mesh(geometry);
      mesh.userData = {
        hemisphere,
        atlas,
        kind: 'ribbon',
        region_id: record.region_ids[index],
      };
      sources.push(mesh);
    }
  }
  return sources;
}

export function addSolidSources(
  sections: SolidSections,
  sources: readonly SolidSource[],
  anatomy: SolidSourceAnatomy,
  appearance: Pick<Appearance, 'tissue' | 'intensity'>,
  band: Band,
  whiteMatter: WhiteMatter | null = null,
): void {
  for (const source of sources) {
    // Only the white envelope's cap lies across gyral white matter.
    const sampled = source.userData['boundary'] === 'white' ? whiteMatter : null;
    const material = createSolidMaterial(anatomy, appearance, sampled);
    addCapLabels(material, anatomy.capLabels);
    addMriAppearance(material, anatomy.mriUniforms, 'capLift');
    addBoundaryEdges(material, anatomy.capEdges, {
      volume: 'capLabelVolume',
      shape: 'capLabelShape',
      toLabels: 'capWorldToLabels',
      // Every cap lies on the plane the label grid covers, meshed solids included.
      enabled: 'capLabelsEnabled',
      selected: 'capHighlightCodes.y',
    });
    if (source.userData['mri_registered'] === false) material.userData['tissueRelief'].value = 0;
    sections.add(source, material, band);
  }
}

/**
 * Index a cut atlas's labels the two ways a solid can be identified.
 *
 * Only tissue is found by code. A cortical parcel's code is its own atlas's
 * numbering, and HCP-MMP's areas 2 and 41 share the codes of cerebral white matter.
 */
export function indexLabels(labels: readonly Label[]): LabelIndex {
  const byRegion = new Map<string, Label>();
  const byCode = new Map<number, Label>();
  for (const label of labels) {
    if (label.region_id) byRegion.set(label.region_id, label);
    if (label.kind !== 'cortex') byCode.set(label.source_label_id, label);
  }
  return { byRegion, byCode };
}

/**
 * The cut label a solid stands for, or null where the atlas has none.
 *
 * A parcel whose medial wall the segmentation never labelled still has to be
 * painted, so it borrows a cortex label carrying no region — the same record
 * shape the voxel path resolves to `unlabelled`.
 */
function solidLabel(
  source: PaintableSolid['source'],
  { byRegion, byCode }: LabelIndex,
): Label | null {
  const { kind, region_id: region, boundary } = source.userData;
  const hemisphere = source.userData.hemisphere as Label['hemisphere'];
  if (region) {
    return (
      byRegion.get(region) ??
      (kind === 'ribbon'
        ? {
            source_label_id: 0,
            name: region,
            color: [0, 0, 0],
            hemisphere,
            kind: 'cortex',
            region_id: null,
          }
        : null)
    );
  }
  return boundary === 'white' ? (byCode.get(WHITE_MATTER[hemisphere as Side]) ?? null) : null;
}

/** Whether this solid belongs to the cut being drawn at all. */
function partOfCut(
  source: PaintableSolid['source'],
  { atlas, detail, wedged }: { atlas: string; detail: string; wedged: boolean },
): boolean {
  const { kind, boundary, atlas: owner, detail: level } = source.userData;
  if (kind === 'ribbon') return owner === atlas;
  // Both detail levels segment the same anatomy, so the cut shows the one the
  // rest of the viewer is showing; two thalami in one place is the alternative.
  if (level) return level === detail;
  // Parcel solids describe the ribbon exactly; the pial envelope is the
  // one-colour stand-in for an atlas that has no surface to cut them from.
  if (boundary === 'pial') return !wedged;
  return true;
}

/** An isolated parcel keeps its hemisphere's white envelope up; the cap discards the rest. */
function holdsIsolatedWhiteMatter(
  source: PaintableSolid['source'],
  state: SolidPaintState,
  lookup: PaletteLookup | undefined,
  whiteMatter: WhiteMatter | null | undefined,
): boolean {
  const { boundary, hemisphere } = source.userData;
  return (
    boundary === 'white' &&
    Boolean(whiteMatter?.holds(state.isolatedRegion!)) &&
    lookup?.regions?.get(state.isolatedRegion!)?.hemisphere === hemisphere
  );
}

function tissueVisible(source: PaintableSolid['source'], state: SolidPaintState): boolean {
  const { hemisphere, boundary, kind, detail } = source.userData;
  if (state.isolatedRegion) return false;
  if (state.hemisphere !== 'both' && hemisphere !== 'midline' && hemisphere !== state.hemisphere)
    return false;
  if (boundary) return state.cortexVisible && state.cortexOpacity > 0;
  if ((kind === 'structure' || detail) && state.internalVisible === false) return false;
  return true;
}

/**
 * Colour every solid from the rule the voxel palette uses.
 *
 * Reading the same function is what keeps a parcel one colour whether the cut
 * face was sampled from the label volume or capped from its own geometry.
 */
export function paintSolids(
  sections: { solids: PaintableSolid[] },
  {
    labels,
    state,
    atlas,
    detail,
    wedged,
    appearance,
    lookup,
    whiteMatter,
  }: {
    labels: LabelIndex;
    state: SolidPaintState;
    atlas: string;
    detail: string;
    wedged: boolean;
    appearance: Pick<Appearance, 'tissue' | 'intensity'>;
    lookup?: PaletteLookup;
    whiteMatter?: WhiteMatter | null;
  },
): void {
  // Only tissue colour carries the T1 brightness it was tuned against; under a
  // published palette that modulation would distort the datum, exactly as it
  // would on a voxel cut face. Relief is lighting, not colour, so it stays.
  const published =
    usesAtlasColors(state) ||
    usesNetworkColors(state) ||
    usesTerritoryColors(state) ||
    usesCabNpColors(state) ||
    usesPaint(state);
  const variation = published ? 0 : appearance.intensity.cut_strength;
  const mri = state.surfaceColor === 'mri' && !usesPaint(state);
  const sampledAtlas = mri && !wedged;
  const sampledIsolation =
    sampledAtlas &&
    labels.byRegion.has(state.isolatedRegion!) &&
    !sections.solids.some((solid) => solid.source.userData['region_id'] === state.isolatedRegion);
  for (const solid of sections.solids) {
    solid.cap.material.userData['tissueVariation'].value =
      solid.source.userData['mri_registered'] === false ? 0 : variation;
    const { source, cap } = solid;
    if (
      !partOfCut(source, { atlas, detail, wedged }) ||
      (mri && source.userData['mri_registered'] === false)
    ) {
      solid.visible = false;
      continue;
    }
    const label = solidLabel(source, labels);
    // What a cut face answers for is what it was painted as, which is not
    // always what its mesh was built from: an envelope borrows a tissue label,
    // and a medial wall borrows one carrying no region at all.
    solid.region = (label ? label.region_id : source.userData['region_id']) ?? null;
    const sampled = sampledAtlas && (!solid.region || sampledIsolation);
    solid.cap.material.userData['sampledLabels'].value = sampled;
    const capState = sampledIsolation && sampled ? { ...state, isolatedRegion: null } : state;
    if (sampled) solid.region = null;
    const isolatedWhiteMatter = holdsIsolatedWhiteMatter(source, state, lookup, whiteMatter);
    if (!label) {
      const { boundary } = source.userData;
      const record = lookup?.regions?.get(source.userData.region_id!);
      solid.visible =
        (record?.kind === 'structure'
          ? visibilityOf(record, { ...capState, detail }).visible
          : tissueVisible(source, capState)) || isolatedWhiteMatter;
      const painted = usesPaint(state) ? state.paint!.colors.get(source.userData.region_id!) : null;
      if (boundary) {
        cap.material.color.set(appearance.tissue[boundary === 'pial' ? 'cortex' : 'white']);
      } else if (painted) {
        cap.material.color.setRGB(
          ...(painted.map((value) => value / 255) as [number, number, number]),
          SRGBColorSpace,
        );
      } else if (usesAtlasColors(state) && !usesPaint(state)) {
        // A detail level the cut atlas never labelled still has its own
        // published colour on the mesh, which is what the surface shows too.
        cap.material.color.copy((source.material as MeshBasicMaterial).color);
      } else {
        cap.material.color.set(tissueColor(source.userData, appearance.tissue));
      }
      continue;
    }
    const { color, visible } = labelAppearance(label, capState, appearance.tissue, lookup);
    const record = lookup?.regions?.get(source.userData.region_id!);
    solid.visible =
      (visible &&
        (record?.kind !== 'structure' || visibilityOf(record, { ...capState, detail }).visible)) ||
      isolatedWhiteMatter;
    cap.material.color.copy(color);
  }
}
