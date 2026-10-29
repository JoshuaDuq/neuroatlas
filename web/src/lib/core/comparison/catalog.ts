import type { Language, Manifest, Region } from '../../types/index.ts';
import { labelOf } from '../catalog/labels.ts';

const ATLASES = ['destrieux', 'hcp-mmp', 'julich', 'schaefer'] as const;

const HEMISPHERES = ['left', 'right'];
const MARGINAL_TOLERANCE = 1e-10;
const isRecord = (value: unknown) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isArea = (value: unknown): value is number => Number.isFinite(value) && (value as number) > 0;

/** A published file with the SHA-256 that pins it. */
interface ComparisonFile {
  file: string;
  sha256: string;
}

/** `atlas-comparison.json`: whole-pial overlap areas between the two cortical atlases. */
export interface ComparisonData {
  schema_version: 1;
  anatomy_id: string;
  atlases: readonly string[];
  surface: string;
  method: string;
  units: string;
  totals: Readonly<Record<string, number>>;
  pairs: readonly { region_ids: readonly string[]; area_mm2: number; mesh_id: string }[];
  geometry: ComparisonFile;
  sources: readonly {
    hemisphere: string;
    pial: ComparisonFile;
    annotations: readonly (ComparisonFile & { atlas: string })[];
  }[];
  atlas_assets: readonly (ComparisonFile & { atlas: string; citation: string })[];
}

/** The manifest fields the comparison reads. */
export type ComparisonManifest = Pick<Manifest, 'regions' | 'anatomy' | 'atlases'> & {
  atlas_comparison?: Manifest['atlas_comparison'];
  atlas_comparisons?: Manifest['atlas_comparisons'];
};

/** Each declaration identifies an independently measured pair on the same pial surface. */
export function comparisonDeclarations(manifest: ComparisonManifest) {
  return (
    manifest.atlas_comparisons ??
    (manifest.atlas_comparison
      ? [{ ...manifest.atlas_comparison, atlases: ['destrieux', 'hcp-mmp'] as const }]
      : [])
  );
}

/** The atlases a region of `atlas` is measured against, in the manifest's order, with each pair's file. */
export function comparisonPartners(manifest: ComparisonManifest, atlas: string | undefined) {
  return comparisonDeclarations(manifest).flatMap((declaration) =>
    atlas !== undefined && declaration.atlases.includes(atlas)
      ? [{ atlas: declaration.atlases.find((other) => other !== atlas)!, declaration }]
      : [],
  );
}

export function comparisonDeclaration(manifest: ComparisonManifest, atlases: readonly string[]) {
  return comparisonDeclarations(manifest).find(
    (entry) =>
      entry.atlases.length === atlases.length &&
      entry.atlases.every((atlas, index) => atlas === atlases[index]),
  );
}

export interface ComparisonRow {
  regionId: string;
  areaMm2: number;
  meshId: string;
  fraction: number;
}

export interface Comparison {
  sourceRegionId: string;
  targetAtlas: (typeof ATLASES)[number];
  totalAreaMm2: number;
  rows: ComparisonRow[];
  unassignedAreaMm2: number;
  unassignedFraction: number;
}

function requireComparison(condition: unknown, description: string): asserts condition {
  if (!condition) throw new Error(`Invalid atlas comparison: ${description}.`);
}

function validateFile(value: unknown, description: string) {
  const record = value as Partial<ComparisonFile>;
  requireComparison(isRecord(record) && isText(record.file), `missing ${description} file`);
  requireComparison(
    typeof record.sha256 === 'string' && /^[0-9a-f]{64}$/.test(record.sha256),
    `missing or invalid ${description} SHA-256`,
  );
}

const isAtlas = (atlas: string | undefined): atlas is (typeof ATLASES)[number] =>
  (ATLASES as readonly (string | undefined)[]).includes(atlas);
const isComparedIn = (atlases: readonly string[], atlas: string | undefined) =>
  (atlases as readonly (string | undefined)[]).includes(atlas);

function indexRegions(manifest: ComparisonManifest, comparedAtlases: readonly string[]) {
  validateFile(comparisonDeclaration(manifest, comparedAtlases), 'declared comparison');
  requireComparison(Array.isArray(manifest.regions), 'missing manifest regions');
  const regions = new Map<string, Region>();
  for (const region of manifest.regions) {
    requireComparison(
      isRecord(region) && isText(region.id) && !regions.has(region.id),
      'invalid or duplicate manifest region',
    );
    if (isComparedIn(comparedAtlases, region.atlas)) {
      requireComparison(
        ['cortex', 'non-region'].includes(region.kind) &&
          HEMISPHERES.includes(region.hemisphere) &&
          region.id.startsWith(`${region.atlas}:${region.hemisphere}:`) &&
          isText(region.source_name),
        `invalid cortical region metadata for ${region.id}`,
      );
      requireComparison(
        isText(labelOf(region, 'en')?.name) && isText(labelOf(region, 'fr')?.name),
        `missing anatomical name for ${region.id}`,
      );
    }
    regions.set(region.id, { ...region });
  }
  return regions;
}

function validateIdentity(data: ComparisonData, manifest: ComparisonManifest) {
  requireComparison(
    isRecord(manifest) &&
      isRecord(manifest.anatomy) &&
      isText(manifest.anatomy.id) &&
      isText(manifest.anatomy.subject),
    'missing subject identity',
  );
  requireComparison(isRecord(data) && data.schema_version === 1, 'expected schema_version 1');
  requireComparison(
    data.anatomy_id === manifest.anatomy.id,
    'comparison subject does not match manifest',
  );
  requireComparison(
    Array.isArray(data.atlases) &&
      data.atlases.length === 2 &&
      data.atlases.every(isAtlas) &&
      ATLASES.indexOf(data.atlases[0] as (typeof ATLASES)[number]) <
        ATLASES.indexOf(data.atlases[1] as (typeof ATLASES)[number]),
    'invalid atlas order or identity',
  );
  requireComparison(data.surface === 'pial', 'expected the original pial surface');
  requireComparison(data.method === 'barycentric-vertex-cells', 'invalid area measurement method');
  requireComparison(data.units === 'mm2', 'area units must be mm2');
  validateFile(data.geometry, 'overlap geometry');
}

function validateSources(sources: ComparisonData['sources'], comparedAtlases: readonly string[]) {
  requireComparison(
    Array.isArray(sources) && sources.length === HEMISPHERES.length,
    'missing hemisphere source provenance',
  );
  const hemispheres = new Set<string>();
  for (const source of sources) {
    requireComparison(
      isRecord(source) &&
        HEMISPHERES.includes(source.hemisphere) &&
        !hemispheres.has(source.hemisphere),
      'invalid or duplicate source hemisphere',
    );
    hemispheres.add(source.hemisphere);
    validateFile(source.pial, `${source.hemisphere} pial source`);
    requireComparison(
      Array.isArray(source.annotations) && source.annotations.length === 2,
      `missing ${source.hemisphere} annotations`,
    );
    const atlases = new Set<string>();
    for (const annotation of source.annotations) {
      validateFile(annotation, `${source.hemisphere} annotation source`);
      requireComparison(
        comparedAtlases.includes(annotation.atlas) && !atlases.has(annotation.atlas),
        `invalid or duplicate ${source.hemisphere} annotation atlas`,
      );
      atlases.add(annotation.atlas);
    }
  }
}

function validateAtlasAssets(
  assets: ComparisonData['atlas_assets'],
  manifest: ComparisonManifest,
  comparedAtlases: readonly string[],
) {
  requireComparison(
    Array.isArray(assets) && assets.length === 2 && Array.isArray(manifest.atlases),
    'missing cortical asset provenance',
  );
  const atlases = new Set<string>();
  for (const asset of assets) {
    validateFile(asset, 'cortical atlas asset');
    requireComparison(
      comparedAtlases.includes(asset.atlas) && !atlases.has(asset.atlas),
      'invalid or duplicate cortical atlas asset',
    );
    atlases.add(asset.atlas);
    const published = manifest.atlases.find((atlas) => atlas.id === asset.atlas);
    requireComparison(
      published &&
        published.file === asset.file &&
        isText(asset.citation) &&
        published.citation === asset.citation,
      `cortical asset file or citation does not match ${asset.atlas}`,
    );
  }
}

function indexTotals(
  totals: ComparisonData['totals'],
  regions: ReadonlyMap<string, Region>,
  comparedAtlases: readonly string[],
) {
  requireComparison(isRecord(totals), 'missing per-region area totals');
  const measured = [...regions.values()].filter((region) =>
    isComparedIn(comparedAtlases, region.atlas),
  );
  const areas = new Map(Object.entries(totals));
  requireComparison(areas.size === measured.length, 'incomplete per-region area totals');
  for (const [id, area] of areas) {
    requireComparison(
      isComparedIn(comparedAtlases, regions.get(id)?.atlas) && isArea(area),
      `unknown region or invalid total for ${id}`,
    );
  }
  for (const region of measured) {
    requireComparison(areas.has(region.id), `missing total for ${region.id}`);
  }
  return areas;
}

interface Contribution {
  regionId: string;
  areaMm2: number;
  meshId: string;
}

function indexPairs(
  pairs: ComparisonData['pairs'],
  totals: ReadonlyMap<string, number>,
  regions: ReadonlyMap<string, Region>,
  comparedAtlases: readonly string[],
) {
  requireComparison(Array.isArray(pairs) && pairs.length > 0, 'missing overlap pairs');
  const rows = new Map<string, Contribution[]>([...totals.keys()].map((id) => [id, []]));
  const pairIds = new Set<string>();
  const meshIds = new Set<string>();
  for (const pair of pairs) {
    requireComparison(
      isRecord(pair) && Array.isArray(pair.region_ids as unknown) && pair.region_ids.length === 2,
      'invalid overlap region identifiers',
    );
    const endpoints = pair.region_ids.map((id: string) => regions.get(id));
    requireComparison(
      endpoints.every(
        (region: Region | undefined, index: number) =>
          region?.atlas === comparedAtlases[index] && totals.has(region.id),
      ) && endpoints[0]!.hemisphere === endpoints[1]!.hemisphere,
      'overlap region atlas or hemisphere mismatch',
    );
    const id = pair.region_ids.join('|');
    requireComparison(!pairIds.has(id), `duplicate overlap pair ${id}`);
    requireComparison(
      isText(pair.mesh_id) && !meshIds.has(pair.mesh_id),
      'invalid or duplicate overlap mesh ID',
    );
    requireComparison(isArea(pair.area_mm2), `invalid overlap area for ${id}`);
    pairIds.add(id);
    meshIds.add(pair.mesh_id);
    for (const [index, regionId] of pair.region_ids.entries()) {
      rows.get(regionId)!.push({
        regionId: pair.region_ids[1 - index],
        areaMm2: pair.area_mm2,
        meshId: pair.mesh_id,
      });
    }
  }
  for (const [id, contributions] of rows) {
    const marginal = contributions.reduce((area, row) => area + row.areaMm2, 0);
    const total = totals.get(id)!;
    requireComparison(
      Number.isFinite(marginal) && Math.abs(marginal - total) <= total * MARGINAL_TOLERANCE,
      `overlap marginal does not conserve the whole area of ${id}`,
    );
    contributions.sort(
      (a, b) => b.areaMm2 - a.areaMm2 || a.regionId.localeCompare(b.regionId, 'en'),
    );
  }
  return rows;
}

function csvCell(value: unknown) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function encodeCsv(records: readonly Record<string, unknown>[]) {
  const columns = Object.keys(records[0]);
  const lines = [columns, ...records.map((record) => columns.map((column) => record[column]))];
  return `${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function provenanceOf(data: ComparisonData, manifest: ComparisonManifest) {
  const comparison = comparisonDeclaration(manifest, data.atlases)!;
  const provenance: Record<string, unknown> = {
    schema_version: data.schema_version,
    anatomy_id: data.anatomy_id,
    subject: manifest.anatomy.subject,
    surface: data.surface,
    method: data.method,
    units: data.units,
    sources_json: JSON.stringify(data.sources),
    atlas_assets_json: JSON.stringify(data.atlas_assets),
    geometry_file: data.geometry.file,
    geometry_sha256: data.geometry.sha256,
    comparison_file: comparison.file,
    comparison_sha256: comparison.sha256,
  };
  for (const field of ['reconstruction', 'hcp_projected_from'] as const) {
    if (Object.hasOwn(manifest.anatomy, field)) provenance[field] = manifest.anatomy[field];
  }
  return provenance;
}

export type ComparisonCatalog = ReturnType<typeof createComparisonCatalog>;

/** Whole-pial area comparisons. Unassigned labels contribute to both directional margins. */
export function createComparisonCatalog(data: ComparisonData, manifest: ComparisonManifest) {
  validateIdentity(data, manifest);
  const regions = indexRegions(manifest, data.atlases);
  validateSources(data.sources, data.atlases);
  validateAtlasAssets(data.atlas_assets, manifest, data.atlases);
  const totals = indexTotals(data.totals, regions, data.atlases);
  const contributions = indexPairs(data.pairs, totals, regions, data.atlases);
  const provenance = provenanceOf(data, manifest);
  const regionOf = (id: string) => {
    const region = regions.get(id);
    if (!region) throw new Error(`Unknown region: ${id}`);
    return region;
  };
  const compared = (region: Region) =>
    isComparedIn(data.atlases, region.atlas) && region.kind === 'cortex';
  const targetAtlasOf = (region: Region) =>
    data.atlases.find((atlas) => atlas !== region.atlas)! as (typeof ATLASES)[number];

  return {
    comparisonFor(regionId: string): Comparison | null {
      const region = regionOf(regionId);
      if (!compared(region)) return null;
      const totalAreaMm2 = totals.get(regionId)!;
      const rows: ComparisonRow[] = [];
      let unassignedAreaMm2 = 0;
      for (const row of contributions.get(regionId)!) {
        if (regions.get(row.regionId)!.kind === 'non-region') unassignedAreaMm2 += row.areaMm2;
        else rows.push({ ...row, fraction: row.areaMm2 / totalAreaMm2 });
      }
      return {
        sourceRegionId: regionId,
        targetAtlas: targetAtlasOf(region),
        totalAreaMm2,
        rows,
        unassignedAreaMm2,
        unassignedFraction: unassignedAreaMm2 / totalAreaMm2,
      };
    },

    exportCsv(regionId: string, lang: Language = 'en') {
      const region = regionOf(regionId);
      if (!['en', 'fr'].includes(lang)) {
        throw new Error(`Unknown comparison export language: ${lang}`);
      }
      if (!compared(region)) {
        throw new Error(`Cannot export a cortical comparison for region: ${regionId}`);
      }
      const total = totals.get(regionId)!;
      const source = {
        ...provenance,
        source_atlas: region.atlas,
        source_region_id: regionId,
        source_region_name: labelOf(region, lang)!.name,
        source_annotation_name: region.source_name,
        target_atlas: targetAtlasOf(region),
        total_area_mm2: total,
      };
      return encodeCsv(
        contributions.get(regionId)!.map((row) => {
          const target = regions.get(row.regionId)!;
          return {
            ...source,
            target_region_id: target.id,
            target_region_name: labelOf(target, lang)!.name,
            target_source_name: target.source_name,
            target_kind: target.kind,
            area_mm2: row.areaMm2,
            fraction: row.areaMm2 / total,
            mesh_id: row.meshId,
          };
        }),
      );
    },
  };
}
