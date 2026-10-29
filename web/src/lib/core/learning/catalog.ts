import { VIEW_NAMES } from '../../types/index.ts';
import type { Manifest, Region, ViewName } from '../../types/index.ts';
import type { ClinicalCorrection, Translated } from '../clinical/types.ts';

/** One authored landmark of a circuit, in `data/circuits.yaml`. */
export interface AuthoredStep {
  id: string;
  region: string;
  source_name: string;
  covering_regions?: readonly string[];
  name: Translated;
  role: Translated;
  explanation: Translated;
  mapping: Translated;
  view: ViewName;
  plane: 'axial' | 'coronal' | 'sagittal';
  /** Forms of this landmark for anatomies divided differently; each overrides the base fields. */
  alternatives?: readonly Partial<AuthoredStep>[];
}

export interface CircuitReference {
  id: string;
  title: string;
  citation: string;
  url: string;
  pmid?: string;
  nbk?: string;
  pmcid?: string;
  corrections?: readonly ClinicalCorrection[];
}

export interface AuthoredCircuit {
  id: string;
  deficit: string;
  name: Translated;
  summary: Translated;
  route: Translated;
  scope: Translated;
  clinical: Translated;
  references: readonly string[];
  /** Sources for the linked deficit; the other citations provide circuit background. */
  clinical_references: readonly string[];
  steps: readonly AuthoredStep[];
}

/** `data/circuits.yaml`, as authored. */
export interface CircuitData {
  revised: string;
  context_margin_mm: number;
  circuits: readonly AuthoredCircuit[];
  references: readonly CircuitReference[];
}

/** A landmark as the catalog serves it: one resolved form, and the regions it uncovers on arrival. */
export type Landmark = Omit<AuthoredStep, 'alternatives'> & { restores: string[] };
export type Circuit = Omit<AuthoredCircuit, 'steps'> & { steps: Landmark[] };

function requireText(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing text: ${context}`);
}

function requireTranslation(value: unknown, context: string) {
  const translation = value as Record<string, unknown> | undefined;
  for (const lang of ['en', 'fr']) requireText(translation?.[lang], `${context}.${lang}`);
  if (Object.keys(translation!).some((key) => !['en', 'fr'].includes(key))) {
    throw new Error(`Unexpected translation field: ${context}`);
  }
}

function indexRecords<T extends { id: string }>(records: readonly T[], context: string) {
  if (!Array.isArray(records) || !records.length) throw new Error(`Empty ${context}`);
  const index = new Map<string, T>();
  for (const record of records) {
    requireText(record.id, `${context}.id`);
    if (index.has(record.id)) throw new Error(`Duplicate ${context}: ${record.id}`);
    index.set(record.id, record);
  }
  return index;
}

function requireRecord<T>(index: ReadonlyMap<string, T>, id: string, context: string): T {
  const record = index.get(id);
  if (!record) throw new Error(`Unknown ${context}: ${id}`);
  return record;
}

/**
 * The one authored form of a step this anatomy publishes. A step may name
 * alternatives for anatomies divided differently (the cerebellar cortex whole
 * or as lobules); exactly one form's regions must all exist here.
 */
function resolveStep(step: AuthoredStep, regions: ReadonlyMap<string, Region>) {
  const { alternatives = [], ...base } = step;
  if (!alternatives.length) return base;
  const forms: Omit<AuthoredStep, 'alternatives'>[] = [
    base,
    ...alternatives.map((alternative) => ({ ...base, ...alternative })),
  ];
  const present = forms.filter((form) =>
    [form.region, ...(form.covering_regions ?? [])].every((id) => regions.has(id)),
  );
  if (present.length !== 1) {
    throw new Error(
      `${present.length} forms of landmark ${step.id} resolve in this anatomy: ${step.region}`,
    );
  }
  return present[0];
}

function validateStep(step: Landmark, regions: ReadonlyMap<string, Region>) {
  const region = requireRecord(regions, step.region, 'region');
  if (region.source_name !== step.source_name) throw new Error(`Source mismatch: ${step.region}`);
  if (!['cortex', 'structure'].includes(region.kind)) {
    throw new Error(`Unsupported landmark: ${step.region}`);
  }
  if (Object.hasOwn(step, 'covering_regions')) {
    if (!Array.isArray(step.covering_regions) || !step.covering_regions.length) {
      throw new Error(`Empty covering regions: ${step.id}`);
    }
    for (const id of step.covering_regions) {
      const covering = requireRecord(regions, id, 'covering region');
      if (
        region.kind !== 'structure' ||
        covering.kind !== 'structure' ||
        covering.id === region.id ||
        covering.atlas !== region.atlas ||
        covering.hemisphere !== region.hemisphere
      ) {
        throw new Error(`Invalid covering region: ${id}`);
      }
    }
  }
  for (const key of ['name', 'role', 'explanation', 'mapping'] as const) {
    requireTranslation(step[key], `${step.id}.${key}`);
  }
  if (!(VIEW_NAMES as readonly string[]).includes(step.view)) {
    throw new Error(`Unknown view: ${step.view}`);
  }
  if (!['axial', 'coronal', 'sagittal'].includes(step.plane)) {
    throw new Error(`Unknown MRI plane: ${step.plane}`);
  }
}

export type CircuitCatalog = ReturnType<typeof createCircuitCatalog>;

/** Authored lessons must resolve to the exact source labels in this anatomy. */
export function createCircuitCatalog(
  data: CircuitData,
  manifest: Pick<Manifest, 'regions'>,
  deficitIds: Iterable<string>,
) {
  requireText(data.revised, 'revised');
  if (!Number.isFinite(data.context_margin_mm) || data.context_margin_mm <= 0) {
    throw new RangeError('Circuit context margin must be positive millimetres.');
  }
  const authored = indexRecords(data.circuits, 'circuit');
  const circuits = new Map<string, Circuit>();
  const references = indexRecords(data.references, 'reference');
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const deficits = new Set(deficitIds);
  const steps = new Map<string, Map<string, Landmark>>();
  for (const reference of references.values()) {
    requireText(reference.title, `${reference.id}.title`);
    requireText(reference.citation, `${reference.id}.citation`);
    if (new URL(reference.url).protocol !== 'https:') {
      throw new Error(`Invalid reference URL: ${reference.id}`);
    }
    // references.test.ts checks each identifier against its fetched record.
    if (!/^\d+$/.test(reference.pmid ?? '') && !/^NBK\d+$/.test(reference.nbk ?? '')) {
      throw new Error(`Missing PMID or NBK accession: ${reference.id}`);
    }
    if (Object.hasOwn(reference, 'pmcid') && !/^PMC\d+$/.test(reference.pmcid!)) {
      throw new Error(`Invalid PMCID: ${reference.id}`);
    }
    if (reference.corrections !== undefined && !Array.isArray(reference.corrections)) {
      throw new Error(`Invalid corrections: ${reference.id}`);
    }
    for (const correction of reference.corrections ?? []) {
      if (!/^10\.\d{4,9}\/\S+$/.test(correction.doi)) {
        throw new Error(`Invalid correction DOI: ${reference.id}`);
      }
      requireTranslation(correction.summary, `${reference.id}.correction.summary`);
    }
  }
  for (const circuit of authored.values()) {
    for (const key of ['name', 'summary', 'route', 'scope', 'clinical'] as const) {
      requireTranslation(circuit[key], `${circuit.id}.${key}`);
    }
    if (!deficits.has(circuit.deficit))
      throw new Error(`Unknown clinical target: ${circuit.deficit}`);
    if (!Array.isArray(circuit.references) || !circuit.references.length) {
      throw new Error(`Missing references: ${circuit.id}`);
    }
    for (const id of circuit.references) requireRecord(references, id, 'reference');
    if (
      !Array.isArray(circuit.clinical_references) ||
      !circuit.clinical_references.length ||
      new Set(circuit.clinical_references).size !== circuit.clinical_references.length ||
      circuit.clinical_references.some((id) => !circuit.references.includes(id))
    ) {
      throw new Error(`Invalid clinical references: ${circuit.id}`);
    }
    const resolved = circuit.steps.map((step) => resolveStep(step, regions));
    // What other landmarks cover is uncovered again on arriving at this one.
    const covered = new Set(resolved.flatMap((step) => step.covering_regions ?? []));
    const landmarks = indexRecords(
      resolved.map((step) => ({
        ...step,
        restores: [...covered].filter((id) => !(step.covering_regions ?? []).includes(id)),
      })),
      `${circuit.id} landmark`,
    );
    for (const step of landmarks.values()) validateStep(step, regions);
    steps.set(circuit.id, landmarks);
    circuits.set(circuit.id, { ...circuit, steps: [...landmarks.values()] });
  }
  return {
    all: [...circuits.values()],
    revised: data.revised,
    contextMarginMm: data.context_margin_mm,
    get: (id: string) => requireRecord(circuits, id, 'circuit'),
    step(circuitId: string, stepId: string) {
      return requireRecord(requireRecord(steps, circuitId, 'circuit'), stepId, 'landmark');
    },
    reference: (id: string) => requireRecord(references, id, 'reference'),
  };
}
