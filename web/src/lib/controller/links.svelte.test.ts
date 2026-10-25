import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createCatalog } from '../core/catalog/catalog.ts';
import { createSceneCommands } from '../core/state/scene-commands.ts';
import { decodeState } from '../core/state/url-state.ts';
import { createFakeEngine } from '../engine/fake.ts';
import type { FakeEngine } from '../engine/fake.ts';
import { createEngineSync } from '../state/engine-sync.svelte.ts';
import { createLink } from '../state/link.svelte.ts';
import { createLessonStore, createSessionStore } from '../state/session.svelte.ts';
import { announceView, createView } from '../state/view.svelte.ts';
import type { Manifest } from '../types/index.ts';
import { attachAnnouncer } from '../ui/announcer.svelte.ts';
import { createLinks } from './links.ts';

const published = manifest as unknown as Manifest;
const hidden = published.regions.find((region) => region.kind !== 'non-region')!.id;
const domains = { atlas: 'none', domains: [], lesion_checks: {} };

let engine: FakeEngine;
let region: HTMLElement;
let detach: () => void;
let cleanups: (() => void)[];
const page = { hash: '', pathname: '/', search: '', reload() {} };

/** The stores a page builds, in an effect root as a component would; `announce` says the view's changes. */
function build({ announce }: { announce: boolean }) {
  const parts = {} as { links: ReturnType<typeof createLinks> };
  cleanups.push(
    $effect.root(() => {
      const engineState = createEngineSync(engine);
      const session = createSessionStore({ views: ['oblique', 'left'] });
      const lesson = createLessonStore({ get: () => ({ steps: [{}] }) as never });
      const view = createView({
        engine: engineState,
        session,
        lesson,
        anatomy: published.anatomy.id,
        referenceAnatomy: published.anatomy.id,
      });
      const catalog = createCatalog(published);
      if (announce) announceView(view, (selected) => catalog.label(selected.id, view.current).name);
      parts.links = createLinks({
        engine,
        session,
        lesson,
        view,
        link: createLink({ engine, view, write: () => {} }),
        commands: createSceneCommands({
          model: engine.model,
          sections: engine.sections,
          // The scene commands read the session through `assemble`, which the store replaces with `state`.
          session: {
            ...session,
            assemble: (state: object) => ({ ...state, ...session.state }),
          } as never,
          render() {},
        }),
        clinical: { search: () => [] },
        circuits: { all: [], get: () => ({ steps: [] }) as never },
        hooks: {
          chooseExplorer: (explorer) => session.setExplorer(explorer),
          tractsExcursionOpen: () => false,
          forgetScenes() {},
          rememberLessonScene() {},
          openLandmark: async () => true,
          revealInTree() {},
          showDetail() {},
          openFunction() {},
          openDeficit() {},
        },
        followLanguage: (lang) => {
          document.documentElement.lang = lang;
        },
        defaultAnatomy: published.anatomy.id,
        page: { history: window.history, location: page } as never,
      });
    }),
  );
  flushSync();
  return parts;
}

beforeEach(() => {
  engine = createFakeEngine({ manifest: published, domains });
  region = document.createElement('div');
  detach = attachAnnouncer(region);
  cleanups = [];
  vi.useFakeTimers();
});
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  detach();
  vi.useRealTimers();
});

describe('a link-edited language', () => {
  test('is followed by <html lang> and never saved as the reader’s choice', async () => {
    localStorage.setItem('planum-lang', 'en');
    document.documentElement.lang = 'en';
    const { links } = build({ announce: false });
    page.hash = '#lang=fr';
    await links.onHashChange();
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('planum-lang')).toBe('en');
    document.documentElement.lang = 'en';
  });
});

describe('a restored link and the announcer', () => {
  test('says the hidden count once when announceView was created before the link is applied', async () => {
    const { links } = build({ announce: true });
    expect(region.textContent).toBe('');
    links.report(await links.restore(decodeState(`hidden=${hidden}`), { immediate: true }));
    flushSync();
    expect(region.textContent).toBe('1 part hidden');
  });

  test('says nothing when it is created after: the restored count is only recorded', async () => {
    const { links } = build({ announce: false });
    links.report(await links.restore(decodeState(`hidden=${hidden}`), { immediate: true }));
    build({ announce: true });
    flushSync();
    expect(engine.model.settings.hiddenRegions.size).toBe(1);
    expect(region.textContent).toBe('');
  });
});
