import { VIEW_DIRECTIONS } from '../render/camera-views.js';

function requireText(value, context) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing text: ${context}`);
}

function requireTranslation(value, context) {
  for (const lang of ['en', 'fr']) requireText(value?.[lang], `${context}.${lang}`);
  if (Object.keys(value).some(key => !['en', 'fr'].includes(key))) {
    throw new Error(`Unexpected translation field: ${context}`);
  }
}

function indexRecords(records, context) {
  if (!Array.isArray(records) || !records.length) throw new Error(`Empty ${context}`);
  const index = new Map();
  for (const record of records) {
    requireText(record.id, `${context}.id`);
    if (index.has(record.id)) throw new Error(`Duplicate ${context}: ${record.id}`);
    index.set(record.id, record);
  }
  return index;
}

function requireRecord(index, id, context) {
  const record = index.get(id);
  if (!record) throw new Error(`Unknown ${context}: ${id}`);
  return record;
}

function validateStep(step, regions) {
  const region = requireRecord(regions, step.region, 'region');
  if (region.source_name !== step.source_name) throw new Error(`Source mismatch: ${step.region}`);
  if (!['cortex', 'structure'].includes(region.kind)) throw new Error(`Unsupported landmark: ${step.region}`);
  if (Object.hasOwn(step, 'covering_region')) {
    const covering = requireRecord(regions, step.covering_region, 'covering region');
    if (region.kind !== 'structure' || covering.kind !== 'structure' ||
        covering.id === region.id || covering.atlas !== region.atlas ||
        covering.hemisphere !== region.hemisphere) {
      throw new Error(`Invalid covering region: ${step.covering_region}`);
    }
  }
  for (const key of ['name', 'role', 'explanation', 'mapping']) requireTranslation(step[key], `${step.id}.${key}`);
  if (!Object.hasOwn(VIEW_DIRECTIONS, step.view)) throw new Error(`Unknown view: ${step.view}`);
  if (!['axial', 'coronal', 'sagittal'].includes(step.plane)) throw new Error(`Unknown MRI plane: ${step.plane}`);
}

/** Authored lessons must resolve to the exact source labels in this anatomy. */
export function createCircuitCatalog(data, manifest, deficitIds) {
  requireText(data.revised, 'revised');
  if (!Number.isFinite(data.context_margin_mm) || data.context_margin_mm <= 0) {
    throw new RangeError('Circuit context margin must be positive millimetres.');
  }
  const circuits = indexRecords(data.circuits, 'circuit');
  const references = indexRecords(data.references, 'reference');
  const regions = new Map(manifest.regions.map(region => [region.id, region]));
  const deficits = new Set(deficitIds);
  const steps = new Map();
  for (const reference of references.values()) {
    requireText(reference.title, `${reference.id}.title`);
    requireText(reference.citation, `${reference.id}.citation`);
    if (new URL(reference.url).protocol !== 'https:') throw new Error(`Invalid reference URL: ${reference.id}`);
  }
  for (const circuit of circuits.values()) {
    for (const key of ['name', 'summary', 'route', 'scope', 'clinical']) requireTranslation(circuit[key], `${circuit.id}.${key}`);
    if (!deficits.has(circuit.deficit)) throw new Error(`Unknown clinical target: ${circuit.deficit}`);
    if (!Array.isArray(circuit.references) || !circuit.references.length) throw new Error(`Missing references: ${circuit.id}`);
    for (const id of circuit.references) requireRecord(references, id, 'reference');
    const landmarks = indexRecords(circuit.steps, `${circuit.id} landmark`);
    for (const step of landmarks.values()) validateStep(step, regions);
    steps.set(circuit.id, landmarks);
  }
  return {
    all: [...circuits.values()],
    revised: data.revised,
    contextMarginMm: data.context_margin_mm,
    get: id => requireRecord(circuits, id, 'circuit'),
    step(circuitId, stepId) {
      return requireRecord(requireRecord(steps, circuitId, 'circuit'), stepId, 'landmark');
    },
    reference: id => requireRecord(references, id, 'reference'),
  };
}
