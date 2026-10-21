import { labelOf } from '../catalog/labels.js';

const ATLASES = ['destrieux', 'hcp-mmp'];
const HEMISPHERES = ['left', 'right'];
const MARGINAL_TOLERANCE = 1e-10;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isArea = value => Number.isFinite(value) && value > 0;

function requireComparison(condition, description) {
  if (!condition) throw new Error(`Invalid atlas comparison: ${description}.`);
}

function validateFile(record, description) {
  requireComparison(isRecord(record) && isText(record.file), `missing ${description} file`);
  requireComparison(typeof record.sha256 === 'string' && /^[0-9a-f]{64}$/.test(record.sha256),
    `missing or invalid ${description} SHA-256`);
}

function indexRegions(manifest) {
  requireComparison(isRecord(manifest) && isRecord(manifest.anatomy)
    && isText(manifest.anatomy.id) && isText(manifest.anatomy.subject), 'missing subject identity');
  validateFile(manifest.atlas_comparison, 'declared comparison');
  requireComparison(Array.isArray(manifest.regions), 'missing manifest regions');
  const regions = new Map();
  for (const region of manifest.regions) {
    requireComparison(isRecord(region) && isText(region.id) && !regions.has(region.id),
      'invalid or duplicate manifest region');
    if (ATLASES.includes(region.atlas)) {
      requireComparison(['cortex', 'non-region'].includes(region.kind)
        && HEMISPHERES.includes(region.hemisphere)
        && region.id.startsWith(`${region.atlas}:${region.hemisphere}:`)
        && isText(region.source_name), `invalid cortical region metadata for ${region.id}`);
      requireComparison(isText(labelOf(region, 'en')?.name) && isText(labelOf(region, 'fr')?.name),
        `missing anatomical name for ${region.id}`);
    }
    regions.set(region.id, { ...region });
  }
  return regions;
}

function validateIdentity(data, manifest) {
  requireComparison(isRecord(data) && data.schema_version === 1, 'expected schema_version 1');
  requireComparison(data.anatomy_id === manifest.anatomy.id, 'comparison subject does not match manifest');
  requireComparison(Array.isArray(data.atlases) && data.atlases.length === ATLASES.length
    && data.atlases.every((atlas, index) => atlas === ATLASES[index]), 'invalid atlas order or identity');
  requireComparison(data.surface === 'pial', 'expected the original pial surface');
  requireComparison(data.method === 'barycentric-vertex-cells', 'invalid area measurement method');
  requireComparison(data.units === 'mm2', 'area units must be mm2');
  validateFile(data.geometry, 'overlap geometry');
}

function validateSources(sources) {
  requireComparison(Array.isArray(sources) && sources.length === HEMISPHERES.length,
    'missing hemisphere source provenance');
  const hemispheres = new Set();
  for (const source of sources) {
    requireComparison(isRecord(source) && HEMISPHERES.includes(source.hemisphere)
      && !hemispheres.has(source.hemisphere), 'invalid or duplicate source hemisphere');
    hemispheres.add(source.hemisphere);
    validateFile(source.pial, `${source.hemisphere} pial source`);
    requireComparison(Array.isArray(source.annotations) && source.annotations.length === ATLASES.length,
      `missing ${source.hemisphere} annotations`);
    const atlases = new Set();
    for (const annotation of source.annotations) {
      validateFile(annotation, `${source.hemisphere} annotation source`);
      requireComparison(ATLASES.includes(annotation.atlas) && !atlases.has(annotation.atlas),
        `invalid or duplicate ${source.hemisphere} annotation atlas`);
      atlases.add(annotation.atlas);
    }
  }
}

function validateAtlasAssets(assets, manifest) {
  requireComparison(Array.isArray(assets) && assets.length === ATLASES.length
    && Array.isArray(manifest.atlases), 'missing cortical asset provenance');
  const atlases = new Set();
  for (const asset of assets) {
    validateFile(asset, 'cortical atlas asset');
    requireComparison(ATLASES.includes(asset.atlas) && !atlases.has(asset.atlas),
      'invalid or duplicate cortical atlas asset');
    atlases.add(asset.atlas);
    const published = manifest.atlases.find(atlas => atlas.id === asset.atlas);
    requireComparison(published && published.file === asset.file
      && isText(asset.citation) && published.citation === asset.citation,
    `cortical asset file or citation does not match ${asset.atlas}`);
  }
}

function indexTotals(totals, regions) {
  requireComparison(isRecord(totals), 'missing per-region area totals');
  const measured = [...regions.values()].filter(region => ATLASES.includes(region.atlas));
  const areas = new Map(Object.entries(totals));
  requireComparison(areas.size === measured.length, 'incomplete per-region area totals');
  for (const [id, area] of areas) {
    requireComparison(ATLASES.includes(regions.get(id)?.atlas) && isArea(area),
      `unknown region or invalid total for ${id}`);
  }
  for (const region of measured) {
    requireComparison(areas.has(region.id), `missing total for ${region.id}`);
  }
  return areas;
}

function indexPairs(pairs, totals, regions) {
  requireComparison(Array.isArray(pairs) && pairs.length > 0, 'missing overlap pairs');
  const rows = new Map([...totals.keys()].map(id => [id, []]));
  const pairIds = new Set();
  const meshIds = new Set();
  for (const pair of pairs) {
    requireComparison(isRecord(pair) && Array.isArray(pair.region_ids)
      && pair.region_ids.length === ATLASES.length, 'invalid overlap region identifiers');
    const endpoints = pair.region_ids.map(id => regions.get(id));
    requireComparison(endpoints.every((region, index) => region?.atlas === ATLASES[index]
      && totals.has(region.id)) && endpoints[0].hemisphere === endpoints[1].hemisphere,
    'overlap region atlas or hemisphere mismatch');
    const id = pair.region_ids.join('|');
    requireComparison(!pairIds.has(id), `duplicate overlap pair ${id}`);
    requireComparison(isText(pair.mesh_id) && !meshIds.has(pair.mesh_id), 'invalid or duplicate overlap mesh ID');
    requireComparison(isArea(pair.area_mm2), `invalid overlap area for ${id}`);
    pairIds.add(id);
    meshIds.add(pair.mesh_id);
    for (const [index, regionId] of pair.region_ids.entries()) {
      rows.get(regionId).push({ regionId: pair.region_ids[1 - index],
        areaMm2: pair.area_mm2, meshId: pair.mesh_id });
    }
  }
  for (const [id, contributions] of rows) {
    const marginal = contributions.reduce((area, row) => area + row.areaMm2, 0);
    const total = totals.get(id);
    requireComparison(Number.isFinite(marginal)
      && Math.abs(marginal - total) <= total * MARGINAL_TOLERANCE,
    `overlap marginal does not conserve the whole area of ${id}`);
    contributions.sort((a, b) => b.areaMm2 - a.areaMm2 || a.regionId.localeCompare(b.regionId, 'en'));
  }
  return rows;
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function encodeCsv(records) {
  const columns = Object.keys(records[0]);
  const lines = [columns, ...records.map(record => columns.map(column => record[column]))];
  return `${lines.map(line => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function provenanceOf(data, manifest) {
  const provenance = {
    schema_version: data.schema_version, anatomy_id: data.anatomy_id,
    subject: manifest.anatomy.subject, surface: data.surface, method: data.method, units: data.units,
    sources_json: JSON.stringify(data.sources), atlas_assets_json: JSON.stringify(data.atlas_assets),
    geometry_file: data.geometry.file, geometry_sha256: data.geometry.sha256,
    comparison_file: manifest.atlas_comparison.file, comparison_sha256: manifest.atlas_comparison.sha256,
  };
  for (const field of ['reconstruction', 'hcp_projected_from']) {
    if (Object.hasOwn(manifest.anatomy, field)) provenance[field] = manifest.anatomy[field];
  }
  return provenance;
}

/** Whole-pial area comparisons. Unassigned labels contribute to both directional margins. */
export function createComparisonCatalog(data, manifest) {
  const regions = indexRegions(manifest);
  validateIdentity(data, manifest);
  validateSources(data.sources);
  validateAtlasAssets(data.atlas_assets, manifest);
  const totals = indexTotals(data.totals, regions);
  const contributions = indexPairs(data.pairs, totals, regions);
  const provenance = provenanceOf(data, manifest);
  const regionOf = id => {
    const region = regions.get(id);
    if (!region) throw new Error(`Unknown region: ${id}`);
    return region;
  };
  const compared = region => ATLASES.includes(region.atlas) && region.kind === 'cortex';
  const targetAtlasOf = region => region.atlas === ATLASES[0] ? ATLASES[1] : ATLASES[0];

  return {
    comparisonFor(regionId) {
      const region = regionOf(regionId);
      if (!compared(region)) return null;
      const totalAreaMm2 = totals.get(regionId);
      const rows = [];
      let unassignedAreaMm2 = 0;
      for (const row of contributions.get(regionId)) {
        if (regions.get(row.regionId).kind === 'non-region') unassignedAreaMm2 += row.areaMm2;
        else rows.push({ ...row, fraction: row.areaMm2 / totalAreaMm2 });
      }
      return { sourceRegionId: regionId, targetAtlas: targetAtlasOf(region), totalAreaMm2,
        rows, unassignedAreaMm2, unassignedFraction: unassignedAreaMm2 / totalAreaMm2 };
    },

    exportCsv(regionId, lang = 'en') {
      const region = regionOf(regionId);
      if (!['en', 'fr'].includes(lang)) throw new Error(`Unknown comparison export language: ${lang}`);
      if (!compared(region)) throw new Error(`Cannot export a cortical comparison for region: ${regionId}`);
      const total = totals.get(regionId);
      const source = { ...provenance, source_atlas: region.atlas, source_region_id: regionId,
        source_region_name: labelOf(region, lang).name, source_annotation_name: region.source_name,
        target_atlas: targetAtlasOf(region), total_area_mm2: total };
      return encodeCsv(contributions.get(regionId).map(row => {
        const target = regions.get(row.regionId);
        return { ...source, target_region_id: target.id, target_region_name: labelOf(target, lang).name,
          target_source_name: target.source_name, target_kind: target.kind,
          area_mm2: row.areaMm2, fraction: row.areaMm2 / total, mesh_id: row.meshId };
      }));
    },
  };
}
