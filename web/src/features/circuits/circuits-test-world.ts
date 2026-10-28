// The Circuits tab's collaborators for tests, composed as I1 composes them: the real S3 controller,
// stores and catalogs over the fake engine, with the controller's `openMri` panel entry point routed
// to the explorer under test. The scene reader, workspace shell, MRI dialog and X2's `openDeficit`
// belong to other chunks and are recorders. Not shipped.
import { flushSync } from 'svelte';
import { vi } from 'vitest';
import functionalRegionsFile from '../../../../public/models/cdmd/functional-regions.json' with { type: 'json' };
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import termsFile from '../../../../public/models/cdmd/neurosynth-terms.json' with { type: 'json' };
import { createExcursions } from '../../lib/controller/excursion.svelte.ts';
import { createCatalog } from '../../lib/core/catalog/catalog.ts';
import {
  validateFunctionalRegions,
  type FunctionalRegions,
} from '../../lib/core/catalog/functional-regions.ts';
import {
  validateNeuropsychDomains,
  type NeuropsychDomains,
  type NeurosynthTerms,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import { loadClinicalCatalog } from '../../lib/core/clinical/load.ts';
import { loadCircuitCatalog } from '../../lib/core/learning/load.ts';
import type { ReaderFailure, ReaderState } from '../../lib/core/state/reader-state.ts';
import { createSceneCommands } from '../../lib/core/state/scene-commands.ts';
import type { DomainsData, FunctionalRegionsData, MprPlane } from '../../lib/engine/api.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import { createLessonStore, createSessionStore } from '../../lib/state/session.svelte.ts';
import { createView } from '../../lib/state/view.svelte.ts';
import { VIEW_NAMES, type Manifest } from '../../lib/types/index.ts';
import { createCircuitExplorer } from './circuits-explorer.svelte.ts';

export const manifest = manifestFile as unknown as Manifest;

/** A deferred: what a test uses to hold a download open, then let it finish or fail. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export function createWorld() {
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const domains: NeuropsychDomains = validateNeuropsychDomains(
    domainsFile as unknown as NeuropsychDomains,
    regions,
    termsFile as unknown as NeurosynthTerms,
  );
  const functionalRegions: FunctionalRegions = validateFunctionalRegions(
    functionalRegionsFile as unknown as FunctionalRegions,
    regions,
  );
  const engine = createFakeEngine({
    manifest,
    domains: domains as unknown as DomainsData,
    functionalRegions: functionalRegions as unknown as FunctionalRegionsData,
  });
  const engineSync = createEngineSync(engine);
  const session = createSessionStore({ views: VIEW_NAMES });
  const clinical = loadClinicalCatalog(manifest, domains.units);
  const circuits = loadCircuitCatalog(manifest, clinical);
  const lesson = createLessonStore(circuits);
  const view = createView({
    engine: engineSync,
    session,
    lesson,
    anatomy: manifest.anatomy.id,
    referenceAnatomy: engine.tracts.anatomy,
  });
  const anatomy = createCatalog(manifest);

  const real = createSceneCommands({
    model: engine.model,
    sections: engine.sections,
    session: {
      assemble: (state) => ({ ...state, ...session.state }),
      notify: session.notify,
      setSwitching: session.setSwitching,
      endSwitching: session.endSwitching,
    },
    render: () => undefined,
  });
  /** A test holds a landmark's download open, or makes it fail, through this hook. */
  const hold: { open: (() => Promise<void>) | null } = { open: null };
  const commands: typeof real = {
    ...real,
    openRegion: async (...args) => {
      await hold.open?.();
      return real.openRegion(...args);
    },
  };

  const reader = {
    capture: vi.fn(() => ({}) as unknown as ReaderState),
    apply: vi.fn(
      async (_target: ReaderState, _current: () => boolean): Promise<ReaderFailure[]> => [],
    ),
  };
  const shell = { showDetail: vi.fn(), showList: vi.fn() };
  const mri = {
    show: vi.fn(),
    openPreparedPlane: vi.fn(
      async (_plane: MprPlane, _canOpen: () => boolean): Promise<void> => undefined,
    ),
  };
  const openDeficit = vi.fn();

  // The panels' entry points are the explorer's own, as I1 wires them (decision 9 on #4).
  const excursions = createExcursions(
    { engine, session, lesson, view },
    {
      anatomy,
      domains,
      clinical,
      circuits,
      commands,
      reader,
      shell,
      mri,
      panels: {
        openFunction: () => undefined,
        openDeficit: () => undefined,
        openMri: () => explorer.openMri(),
      },
      render: flushSync,
    },
  );
  const explorer = createCircuitExplorer({
    view,
    circuits,
    excursions,
    labelOf: (id) => anatomy.label(id, { lang: session.state.lang } as never),
    openDeficit,
  });
  return {
    engine,
    session,
    lesson,
    view,
    circuits,
    excursions,
    explorer,
    commands,
    reader,
    mri,
    openDeficit,
    hold,
  };
}

export type World = ReturnType<typeof createWorld>;
