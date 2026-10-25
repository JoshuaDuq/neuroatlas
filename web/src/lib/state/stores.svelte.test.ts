import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type { createCatalog } from '../core/catalog/catalog.ts';
import { createCatalog as buildCatalog } from '../core/catalog/catalog.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import { findingPaint } from '../core/clinical/catalog.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import { createFakeEngine } from '../engine/fake.ts';
import type { FakeEngine } from '../engine/fake.ts';
import type { Manifest } from '../types/index.ts';
import { attachAnnouncer } from '../ui/announcer.svelte.ts';
import { createCatalogStore } from './catalog.svelte.ts';
import { createEngineSync, syncPaint, syncPresentation } from './engine-sync.svelte.ts';
import { createLink } from './link.svelte.ts';
import { createLessonStore, createSessionStore } from './session.svelte.ts';
import { announceView, createView } from './view.svelte.ts';

const published = manifest as unknown as Manifest;
const associations = [
  { id: 'naming', title: { en: 'Naming', fr: 'Dénomination' }, mappings: [{ region: 'a' }] },
];
const sources = {
  domains: { atlas: 'none', domains: [], regions: {}, z_scale: [] } as unknown as NeuropsychDomains,
  clinical: {
    paint: (id: string, finding: string | null = null) => findingPaint(id, associations, finding),
  } as unknown as ClinicalCatalog,
};

let engine: FakeEngine;
let catalog: ReturnType<typeof createCatalog>;
let cleanup: () => void;
let region: HTMLElement;
let detach: () => void;

/** Every store, built inside an effect root as a component would, over the fake engine. */
function build() {
  const parts = {} as {
    engineState: ReturnType<typeof createEngineSync>;
    session: ReturnType<typeof createSessionStore>;
    lesson: ReturnType<typeof createLessonStore>;
    view: ReturnType<typeof createView>;
    catalogStore: ReturnType<typeof createCatalogStore>;
    link: ReturnType<typeof createLink>;
    written: number;
  };
  parts.written = 0;
  cleanup = $effect.root(() => {
    parts.engineState = createEngineSync(engine);
    parts.session = createSessionStore({ views: ['oblique', 'left'] });
    parts.lesson = createLessonStore({ get: () => ({ steps: [{}, {}, {}] }) as never });
    parts.view = createView({
      engine: parts.engineState,
      session: parts.session,
      lesson: parts.lesson,
      anatomy: engine.model.manifest.anatomy.id,
      referenceAnatomy: engine.tracts.anatomy,
    });
    syncPaint(engine.model, parts.view, sources);
    syncPresentation(engine, parts.view, parts.engineState);
    parts.catalogStore = createCatalogStore(catalog, parts.view);
    announceView(parts.view, (selected, view) => catalog.label(selected.id, view).name);
    parts.link = createLink({
      engine,
      view: parts.view,
      write: () => {
        parts.written += 1;
      },
    });
  });
  flushSync();
  return parts;
}

beforeEach(() => {
  engine = createFakeEngine({ manifest: published });
  catalog = buildCatalog(published);
  region = document.createElement('div');
  detach = attachAnnouncer(region);
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  detach();
  vi.useRealTimers();
});

describe('the view', () => {
  test('is the engine’s display state with the session’s over it, the lesson and the anatomies', () => {
    const { view, session, lesson } = build();
    expect(view.current.anatomy).toBe(published.anatomy.id);
    expect(view.current.referenceAnatomy).toBe(engine.tracts.anatomy);
    expect(view.current.atlas).toBe(engine.model.settings.atlas);
    expect(view.current.lang).toBe('en');

    session.setLang('fr');
    lesson.start('circuit');
    lesson.go(2);
    flushSync();
    expect(view.current.lang).toBe('fr');
    expect(view.current.lesson).toEqual({ circuit: 'circuit', step: 2, visited: [0, 2] });
  });

  test('follows each engine change, copied: the model’s and the sections’', () => {
    const { view, engineState } = build();
    engine.model.setHemisphere('left');
    expect(engineState.model.hemisphere).toBe('left');
    flushSync();
    expect(view.current.hemisphere).toBe('left');

    const before = engineState.sections;
    engine.sections.setDisplay({ reverse: true });
    expect(engineState.sections).not.toBe(before);
    expect(engineState.sections.reverse).toBe(true);
    expect(before.reverse).toBe(false);
  });

  test('stops following once disposed', () => {
    const { engineState } = build();
    engineState.dispose();
    engine.model.setHemisphere('right');
    expect(engineState.model.hemisphere).not.toBe('right');
  });
});

describe('the session store', () => {
  test('a command refreshes the state; a refused command does not throw it away', () => {
    const { session } = build();
    expect(session.setView('left')).toBe(true);
    expect(session.state.view).toBe('left');
    expect(session.setView('nowhere')).toBe(false);
    expect(session.state.view).toBe('left');
    expect(() => session.setExplorer('nowhere' as never)).toThrow('Unknown explorer');
  });

  test('notices raised while held wait for the release, which joins them after the link’s own', () => {
    const { session } = build();
    session.holdNotices();
    session.notify({ text: 'First.' });
    session.notify({ text: 'Second.', action: 'reload' });
    expect(session.state.notice).toBeNull();
    session.releaseNotices({ text: 'Link.' });
    expect(session.state.notice).toEqual({ text: 'Link. First. Second.', action: 'reload' });
    session.setQuery('x');
    expect(session.state.notice).toBeNull();
  });

  test('nested holds release only at the last', () => {
    const { session } = build();
    session.holdNotices();
    session.holdNotices();
    session.notify({ text: 'Waiting.' });
    session.releaseNotices();
    expect(session.state.notice).toBeNull();
    session.releaseNotices();
    expect(session.state.notice?.text).toBe('Waiting.');
  });
});

describe('paint', () => {
  test('the open deficit paints the model, lifting it clears it, and the round trip ends', () => {
    const { session } = build();
    session.setExplorer('deficits');
    session.setDeficit('aphasia');
    flushSync();
    expect(engine.model.settings.paint?.id).toBe('deficit:aphasia');

    session.liftPaint();
    flushSync();
    expect(engine.model.settings.paint).toBeNull();

    session.setFinding('naming');
    flushSync();
    expect(engine.model.settings.paint?.id).toBe('deficit:aphasia:naming');
    session.setExplorer('anatomy');
    flushSync();
    expect(engine.model.settings.paint).toBeNull();
  });
});

describe('the presentation', () => {
  test('the stage is told the language and whether the tract reference stands alone', () => {
    const { session } = build();
    expect(engine.presented).toEqual({ lang: 'en', referenceOnly: false });
    session.setLang('fr');
    flushSync();
    expect(engine.presented).toEqual({ lang: 'fr', referenceOnly: false });
  });

  test('the tract reference is alone when the diffusion tab is open on another anatomy', () => {
    const other = createFakeEngine({ manifest: published, tractAnatomy: 'other' });
    const previous = engine;
    engine = other;
    const { session } = build();
    session.setExplorer('diffusion');
    flushSync();
    expect(engine.presented).toEqual({ lang: 'en', referenceOnly: true });
    engine = previous;
  });

  test('the comparison outline is hidden while a cut is drawn', async () => {
    build();
    const geometry = { file: 'overlap.json', sha256: '' };
    await engine.comparison.highlight('pair', geometry);
    expect(engine.highlighted).toBe('pair');
    await engine.sections.setMode('axial');
    flushSync();
    expect(engine.highlighted).toBeNull();
    await engine.sections.setMode('off');
    flushSync();
    expect(engine.highlighted).toBe('pair');
  });
});

describe('the catalog store', () => {
  test('groups and the visible count follow the view, in its language', () => {
    const { catalogStore, session } = build();
    const count = catalogStore.visibleCount;
    expect(count).toBeGreaterThan(0);
    expect(catalogStore.groups).toEqual(catalog.groups({ ...engine.model.settings, lang: 'en' }));

    engine.model.setCortexVisible(false);
    flushSync();
    expect(catalogStore.visibleCount).toBe(
      catalog.visibleCount({ ...engine.model.settings, lang: 'en' }),
    );

    session.setLang('fr');
    flushSync();
    expect(catalogStore.lang).toBe('fr');
    expect(catalogStore.groups).toEqual(catalog.groups({ ...engine.model.settings, lang: 'fr' }));
  });
});

describe('the announcer', () => {
  test('says a selection, then a notice, then the dissection count joined to the next sentence', () => {
    const { session } = build();
    const selectable = published.regions.find(
      (candidate) => candidate.kind !== 'non-region' && engine.model.canSelect(candidate),
    )!;
    const name = catalog.label(selectable.id).name;
    expect(region.textContent).toBe('');

    engine.model.select(selectable.id);
    flushSync();
    expect(region.textContent).toMatch(new RegExp(`^Selected: ${name}, `));

    session.notify({ text: 'Something changed' });
    flushSync();
    expect(region.textContent).toBe('Something changed');

    engine.model.hideRegions([selectable.id]);
    flushSync();
    expect(region.textContent).toBe('1 part hidden');
  });

  test('Undo says the restored selection and the count as one sentence', () => {
    const { session } = build();
    const selectable = published.regions.find(
      (candidate) => candidate.kind !== 'non-region' && engine.model.canSelect(candidate),
    )!;
    const name = catalog.label(selectable.id).name;
    engine.model.select(selectable.id);
    flushSync();
    engine.model.hideRegions([selectable.id]);
    flushSync();
    session.notify(null);
    engine.model.undoDissection();
    flushSync();
    expect(region.textContent).toMatch(new RegExp(`^Selected: ${name}, \\w+\\. All parts shown$`));
  });

  test('says the lost context and its restoration', () => {
    const { session } = build();
    session.setStatus('ready');
    flushSync();
    session.setContextLost();
    flushSync();
    expect(region.textContent).toBe(
      'The 3D view was interrupted by the graphics driver. Restoring…',
    );
    session.setStatus('ready');
    flushSync();
    expect(region.textContent).toBe('Anatomy loaded.');
  });
});

describe('the link', () => {
  test('is written 250 ms after the view changes, once, and again after the camera settles', () => {
    const parts = build();
    vi.advanceTimersByTime(250);
    expect(parts.written).toBe(1);

    parts.session.setQuery('gyrus');
    flushSync();
    parts.session.setQuery('gyrus ');
    flushSync();
    vi.advanceTimersByTime(249);
    expect(parts.written).toBe(1);
    vi.advanceTimersByTime(1);
    expect(parts.written).toBe(2);

    engine.emit('cameraSettled', undefined);
    flushSync();
    vi.advanceTimersByTime(250);
    expect(parts.written).toBe(3);
  });

  test('waits while the restore holds it, and writes once it is released and scheduled', () => {
    const parts = build();
    vi.advanceTimersByTime(250);
    const current = () => true;
    parts.link.hold(current);
    parts.session.setQuery('held');
    flushSync();
    vi.advanceTimersByTime(250);
    expect(parts.written).toBe(1);
    parts.link.release(current);
    parts.link.schedule();
    vi.advanceTimersByTime(250);
    expect(parts.written).toBe(2);
  });

  test('writes nothing once its component is gone', () => {
    const parts = build();
    cleanup();
    parts.session.setQuery('late');
    flushSync();
    engine.emit('cameraSettled', undefined);
    vi.advanceTimersByTime(1000);
    expect(parts.written).toBe(0);
  });
});
