import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import { paintFor } from '../core/state/paint.ts';
import type { Engine, EngineModel, SectionsState } from '../engine/api.ts';
import type { ModelState } from '../types/index.ts';
import type { ViewStore } from './view.svelte.ts';

/**
 * The engine's display state, mirrored. Assigned synchronously in the `change` listener, as a copy:
 * `sections.state` is mutated in place, so the same object twice would not be a change.
 */
export function createEngineSync(engine: Pick<Engine, 'model' | 'sections' | 'on'>) {
  const modelSnapshot = (state: ModelState): ModelState => ({ ...state });
  const sectionsSnapshot = (state: SectionsState): SectionsState => ({
    ...state,
    crosshair: [...state.crosshair],
  });
  let model = $state.raw(modelSnapshot(engine.model.state));
  let sections = $state.raw(sectionsSnapshot(engine.sections.state));
  const stop = engine.on('change', (change) => {
    model = modelSnapshot(change.model);
    sections = sectionsSnapshot(change.sections);
  });
  return {
    get model() {
      return model;
    },
    get sections() {
      return sections;
    },
    dispose: stop,
  };
}

export type EngineSync = ReturnType<typeof createEngineSync>;

/**
 * Paints the model from the view, before the view's snapshot is read (app.js:1612). A changed paint
 * makes the model emit `change`, which updates the view and runs this again; it ends because
 * `setPaint` ignores a paint it already shows.
 */
export function syncPaint(
  model: Pick<EngineModel, 'setPaint'>,
  view: ViewStore,
  sources: { domains: NeuropsychDomains; clinical: ClinicalCatalog },
) {
  $effect.pre(() => model.setPaint(paintFor(view.current, sources)));
}
