import { vi } from 'vitest';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { createCatalog } from '../core/catalog/catalog.ts';
import { validateNeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import { loadClinicalCatalog } from '../core/clinical/load.ts';
import { loadCircuitCatalog } from '../core/learning/load.ts';
import type { ReaderFailure, ReaderState } from '../core/state/reader-state.ts';
import { createSceneCommands } from '../core/state/scene-commands.ts';
import { createFakeEngine } from '../engine/fake.ts';
import type { Call } from '../engine/fake.ts';
import type { DomainsData } from '../engine/api.ts';
import { createEngineSync } from '../state/engine-sync.svelte.ts';
import { createLessonStore, createSessionStore } from '../state/session.svelte.ts';
import { createView } from '../state/view.svelte.ts';
import { VIEW_NAMES } from '../types/index.ts';
import type { Manifest } from '../types/index.ts';
import { createExcursions } from './excursion.svelte.ts';

export const manifest = manifestFile as unknown as Manifest;

/** The scene a test's reader "was in": any distinguishable object stands for it. */
export const sceneBefore = (label: string) => ({ label }) as unknown as ReaderState;

/**
 * The excursion controller over the fake engine, the real stores and the real catalogs, with the
 * collaborators that belong to other chunks (the scene reader, the workspace, the MRI dialog) as
 * recorders. `log` interleaves what they record with `render()` and the engine's calls, so a test
 * can say in which order a command did things.
 */
export function createScene() {
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const domains: NeuropsychDomains = validateNeuropsychDomains(
    domainsFile as unknown as NeuropsychDomains,
    regions,
  );
  const engine = createFakeEngine({ manifest, domains: domains as unknown as DomainsData });
  const engineState = createEngineSync(engine);
  const session = createSessionStore({ views: VIEW_NAMES });
  const circuits = loadCircuitCatalog(manifest, loadClinicalCatalog(manifest));
  const lesson = createLessonStore(circuits);
  const view = createView({
    engine: engineState,
    session,
    lesson,
    anatomy: manifest.anatomy.id,
    referenceAnatomy: engine.tracts.anatomy,
  });
  const clinical = loadClinicalCatalog(manifest);
  const anatomy = createCatalog(manifest);

  // The collaborators' calls go into the engine's own call log, so one timeline orders them all.
  const note = (domain: string, method: string, ...args: unknown[]) =>
    (engine.calls as Call[]).push({ domain, method, args });
  const commands = createSceneCommands({
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
  let captured = 0;
  const reader = {
    capture: vi.fn(() => sceneBefore(`scene ${++captured}`)),
    apply: vi.fn(
      async (_target: ReaderState, _current: () => boolean): Promise<ReaderFailure[]> => [],
    ),
  };
  const shell = {
    showDetail: vi.fn(() => note('shell', 'showDetail')),
    showList: vi.fn(() => note('shell', 'showList')),
  };
  const mri = {
    show: vi.fn((options: { instant: boolean }) => {
      note('mri', 'show', options);
    }),
    openPreparedPlane: vi.fn(async (plane: string, _canOpen: () => boolean) => {
      note('mri', 'openPreparedPlane', plane);
    }),
  };
  const render = vi.fn(() => note('app', 'render'));

  const excursions = createExcursions(
    { engine, session, lesson, view },
    { anatomy, domains, clinical, circuits, commands, reader, shell, mri, render },
  );
  return {
    engine,
    session,
    lesson,
    view,
    domains,
    clinical,
    circuits,
    commands,
    reader,
    shell,
    mri,
    render,
    excursions,
    /** The timeline since `from`, as `domain.method`: the engine's calls, `render` and the shell. */
    calls: (from = 0) =>
      engine.calls.slice(from).map(({ domain, method }) => `${domain}.${method}`),
  };
}

export type Scene = ReturnType<typeof createScene>;
