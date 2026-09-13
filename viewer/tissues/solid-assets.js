import { visibilityOf } from '../catalog/visibility.js';
import { DoubleSide, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fetchAsset } from '../model/asset-cache.js';
import { tissueColor } from '../render/materials.js';
import { labelAppearance, usesAtlasColors, usesNetworkColors } from './palette.js';
import { buildRibbonWedges } from './ribbon-wedges.js';
import { createSolidMaterial } from './solid-material.js';

const HEMISPHERES = ['left', 'right'];
const WHITE_MATTER = { left: 2, right: 41 };

/** Later bands cap over earlier ones where their solids overlap. */
export const BANDS = { envelope: 0, ribbon: 1, structure: 2 };

async function loadMeshes(url) {
  const bytes = await fetchAsset(url);
  const { scene } = await new GLTFLoader().parseAsync(bytes, '');
  scene.updateMatrixWorld(true);
  const sources = [];
  scene.traverse(source => {
    if (!source.isMesh) return;
    source.material.side = DoubleSide;
    sources.push(source);
  });
  return sources;
}

/** Surface reconstruction defines tissue shape independently of the chosen atlas. */
export async function loadSolidSources(manifest, baseUrl) {
  const envelope = manifest.solid_envelopes;
  if (!envelope?.file) throw new Error('Missing native tissue envelopes in the manifest.');
  return loadMeshes(new URL(envelope.file, baseUrl));
}

/** The cut caps the internal anatomy the viewer is showing, not a fixed layer. */
export async function loadStructureSources(manifest, baseUrl, detail) {
  const level = manifest.detail_levels.find(entry => entry.id === detail);
  if (!level?.file) throw new Error(`Missing solid structures for detail level: ${detail}`);
  const sources = await loadMeshes(new URL(level.file, baseUrl));
  for (const source of sources) source.userData.detail = detail;
  return sources;
}

function envelopeSurface(sources, hemisphere, boundary) {
  const mesh = sources.find(source =>
    source.userData.hemisphere === hemisphere && source.userData.boundary === boundary);
  if (!mesh) throw new Error(`Missing the ${hemisphere} ${boundary} envelope.`);
  const baked = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  return { position: baked.getAttribute('position').array, index: baked.getIndex().array };
}

/**
 * One closed solid per parcel of an atlas.
 *
 * The ribbon between the native envelopes is already published, so an atlas
 * adds only a region index per vertex. Cutting the parcel out of that ribbon
 * puts its boundary on the reconstruction rather than on the 1 mm label grid.
 */
export async function loadRibbonSources(manifest, baseUrl, atlas, envelopes) {
  const record = manifest.atlases.find(entry => entry.id === atlas)?.ribbon_labels;
  if (!record) return [];
  const published = new Uint16Array(await fetchAsset(new URL(record.file, baseUrl)));
  const sources = [];
  let at = 0;
  for (const hemisphere of HEMISPHERES) {
    const count = record.vertex_counts[hemisphere];
    const labels = published.subarray(at, at + count);
    at += count;
    const pial = envelopeSurface(envelopes, hemisphere, 'pial');
    const white = envelopeSurface(envelopes, hemisphere, 'white');
    const wedges = buildRibbonWedges({
      faces: pial.index, pial: pial.position, white: white.position, labels,
    });
    for (const [index, geometry] of wedges) {
      const mesh = new Mesh(geometry);
      mesh.userData = {
        hemisphere, atlas, kind: 'ribbon', region_id: record.region_ids[index],
      };
      sources.push(mesh);
    }
  }
  return sources;
}

export function addSolidSources(sections, sources, anatomy, appearance, band, whiteMatter = null) {
  for (const source of sources) {
    // Only the white envelope's cap lies across gyral white matter.
    const sampled = source.userData.boundary === 'white' ? whiteMatter : null;
    sections.add(source, createSolidMaterial(anatomy, appearance, sampled), band);
  }
}

/** Index a cut atlas's labels the two ways a solid can be identified. */
export function indexLabels(labels) {
  const byRegion = new Map();
  const byCode = new Map();
  for (const label of labels) {
    if (label.region_id) byRegion.set(label.region_id, label);
    byCode.set(label.source_label_id, label);
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
function solidLabel(source, { byRegion, byCode }) {
  const { kind, region_id: region, hemisphere, boundary } = source.userData;
  if (region) {
    return byRegion.get(region) ?? (kind === 'ribbon'
      ? { source_label_id: 0, name: region, color: [0, 0, 0], hemisphere, kind: 'cortex', region_id: null }
      : null);
  }
  return boundary === 'white' ? byCode.get(WHITE_MATTER[hemisphere]) ?? null : null;
}

/** Whether this solid belongs to the cut being drawn at all. */
function partOfCut(source, { atlas, detail, wedged }) {
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
function holdsIsolatedWhiteMatter(source, state, lookup, whiteMatter) {
  const { boundary, hemisphere } = source.userData;
  return boundary === 'white' && Boolean(whiteMatter?.holds(state.isolatedRegion))
    && lookup?.regions?.get(state.isolatedRegion)?.hemisphere === hemisphere;
}

function tissueVisible(source, state) {
  const { hemisphere, boundary } = source.userData;
  if (state.isolatedRegion) return false;
  if (state.hemisphere !== 'both' && hemisphere !== 'midline' &&
      hemisphere !== state.hemisphere) return false;
  return !boundary || (state.cortexVisible && state.cortexOpacity > 0);
}

/**
 * Colour every solid from the rule the voxel palette uses.
 *
 * Reading the same function is what keeps a parcel one colour whether the cut
 * face was sampled from the label volume or capped from its own geometry.
 */
export function paintSolids(sections, {
  labels, state, atlas, detail, wedged, appearance, lookup, whiteMatter,
}) {
  // Only tissue colour carries the T1 brightness it was tuned against; under a
  // published palette that modulation would distort the datum, exactly as it
  // would on a voxel cut face. Relief is lighting, not colour, so it stays.
  const published = usesAtlasColors(state) || usesNetworkColors(state);
  const variation = published ? 0 : appearance.intensity.cut_strength;
  for (const solid of sections.solids) {
    solid.cap.material.userData.tissueVariation.value = variation;
    const { source, cap } = solid;
    if (!partOfCut(source, { atlas, detail, wedged })) {
      solid.visible = false;
      continue;
    }
    const label = solidLabel(source, labels);
    // What a cut face answers for is what it was painted as, which is not
    // always what its mesh was built from: an envelope borrows a tissue label,
    // and a medial wall borrows one carrying no region at all.
    solid.region = (label ? label.region_id : source.userData.region_id) ?? null;
    const isolatedWhiteMatter = holdsIsolatedWhiteMatter(source, state, lookup, whiteMatter);
    if (!label) {
      const { boundary } = source.userData;
      const record = lookup?.regions?.get(source.userData.region_id);
      solid.visible = (record?.kind === 'structure'
        ? visibilityOf(record, { ...state, detail }).visible : tissueVisible(source, state))
        || isolatedWhiteMatter;
      if (boundary) {
        cap.material.color.set(appearance.tissue[boundary === 'pial' ? 'cortex' : 'white']);
      } else if (published && !usesNetworkColors(state)) {
        // A detail level the cut atlas never labelled still has its own
        // published colour on the mesh, which is what the surface shows too.
        cap.material.color.copy(source.material.color);
      } else {
        cap.material.color.set(tissueColor(source.userData, appearance.tissue));
      }
      continue;
    }
    const { color, visible } = labelAppearance(label, state, appearance.tissue, lookup);
    const record = lookup?.regions?.get(source.userData.region_id);
    solid.visible = (visible && (record?.kind !== 'structure' || visibilityOf(record, { ...state, detail }).visible)) || isolatedWhiteMatter;
    cap.material.color.copy(color);
  }
}
