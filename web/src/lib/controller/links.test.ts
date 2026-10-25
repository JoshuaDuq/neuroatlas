import assert from 'node:assert/strict';
import { describe, expect, it, vi } from 'vitest';
import { createLinkWriter } from '../core/state/link-writer.ts';
import { createSceneCommands } from '../core/state/scene-commands.ts';
import { decodeState } from '../core/state/url-state.ts';
import { createFakeEngine } from '../engine/fake.ts';
import { createLessonStore, createSessionStore } from '../state/session.svelte.ts';
import type { Manifest } from '../types/index.ts';
import { readRepoJson } from '../../../test/repo.ts';
import { createLinks } from './links.ts';

const published = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const domains = { atlas: 'none', domains: [], lesion_checks: {} };
const mri = { fieldOfView: 256, size: 64, windowCenter: 100, windowWidth: 200 };

/** Links over the fake engine, with a page that records the address bar instead of moving it. */
function setup(viewState: object = {}, anatomy = published.anatomy.id) {
  const followed: string[] = [];
  const engine = createFakeEngine({ manifest: published, domains, mri });
  const session = createSessionStore({ views: ['oblique', 'left', 'right'] });
  const lesson = createLessonStore({ get: () => ({ steps: [{}] }) as never });
  const calls: [string, ...unknown[]][] = [];
  const page = {
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => calls.push(['replace', url]),
    },
    location: {
      hash: '',
      pathname: '/neuroatlas/',
      search: '?x=1',
      reload: () => calls.push(['reload']),
    },
  };
  const link = createLinkWriter(() => {});
  const cancel = link.cancel;
  link.cancel = () => {
    calls.push(['cancel']);
    cancel();
  };
  const commands = createSceneCommands({
    model: engine.model,
    sections: engine.sections,
    // The scene commands read the session through `assemble`, which the store replaces with `state`.
    session: {
      ...session,
      assemble: (state: object) => ({ ...state, ...session.state }),
    } as never,
    render() {},
  });
  const links = createLinks({
    engine,
    session,
    lesson,
    view: {
      get current() {
        return {
          ...engine.model.state,
          ...session.state,
          lesson: lesson.state,
          anatomy,
          referenceAnatomy: anatomy,
          ...viewState,
        };
      },
    } as never,
    link,
    commands,
    clinical: { search: () => [{ id: 'aphasia' }] } as never,
    circuits: { all: [], get: () => ({ steps: [] }) } as never,
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
    defaultAnatomy: 'cdmd',
    followLanguage: (lang) => followed.push(lang),
    page: page as never,
  });
  return { followed, engine, session, links, page, calls, link, commands };
}

describe('writing the link', () => {
  it('replaces the address with the scene, which always names its brain and language', () => {
    const { links, calls } = setup({ hemisphere: 'left' });
    links.write();
    expect(calls).toEqual([
      ['replace', expect.stringMatching(/^#anatomy=cdmd&.*hemi=left&lang=en$/)],
    ]);
  });

  it('carries the cut the sections hold, and the camera the engine reports', async () => {
    const { engine, links } = setup();
    await engine.sections.setMode('coronal');
    engine.sections.setOffset(12.34);
    expect(links.linkState()).toMatchObject({ cut: 'coronal', cutOffset: engine.sections.offset });
    expect(links.linkState().orbit).toEqual(engine.camera.orbitLink());
  });
});

describe('another subject', () => {
  // viewer/app.test.js:235
  it('keeps the cut, view and panel, replaces the link in place and reloads', async () => {
    const { engine, links, calls } = setup(
      {
        anatomy: 'snail',
        atlas: 'hcp-mmp',
        view: 'left',
        explorer: 'deficits',
        selectedDeficit: 'aphasia',
        selectedRegion: { id: 'destrieux:left:29' },
        hiddenRegions: new Set(['x']),
        lang: 'fr',
      },
      'snail',
    );
    await engine.sections.setMode('coronal');
    engine.sections.setOffset(12.34);
    await engine.sections.load();
    engine.sections.setWindow(50, 60);
    expect(links.linkState().mriWindow).toEqual({ center: 50, width: 60 });
    links.switchAnatomy('bert');
    expect(calls.map(([kind]) => kind)).toEqual(['cancel', 'replace', 'reload']);
    const { state } = decodeState(calls[1]![1] as string);
    assert.deepEqual(state, {
      anatomy: 'bert',
      atlas: 'hcp-mmp',
      cut: 'coronal',
      cutAtlas: 'destrieux',
      detail: 'learning',
      cutOffset: 12.3,
      view: 'left',
      explorer: 'deficits',
      selectedDeficit: 'aphasia',
      lang: 'fr',
    });
  });

  it('does nothing for the subject already on screen', () => {
    const { links, calls } = setup();
    links.switchAnatomy(published.anatomy.id);
    expect(calls).toEqual([]);
  });
});

describe('a link edited in place', () => {
  it('reloads for another brain and applies nothing', async () => {
    const { links, page, calls, engine } = setup();
    page.location.hash = '#anatomy=other&hemi=left';
    await links.onHashChange();
    expect(calls).toEqual([['reload']]);
    expect(engine.model.settings.hemisphere).toBe('both');
  });

  it('applies it to the same brain, takes its language and says what it could not apply', async () => {
    const { links, page, session, engine } = setup();
    page.location.hash = '#hemi=left&lang=fr&atlas=missing';
    await links.onHashChange();
    expect(engine.model.settings.hemisphere).toBe('left');
    expect(session.state.lang).toBe('fr');
    expect(session.state.notice?.text).toMatch(/atlas/i);
  });

  it('makes the page follow the language of the edited link, and only then', async () => {
    const { links, page, followed } = setup();
    page.location.hash = '#hemi=left';
    await links.onHashChange();
    expect(followed).toEqual([]);
    page.location.hash = '#lang=fr';
    await links.onHashChange();
    expect(followed).toEqual(['fr']);
  });

  it('reloads for a link without a brain when the page is on another than the default', async () => {
    const { links, page, calls } = setup({}, 'snail');
    page.location.hash = '#hemi=left';
    await links.onHashChange();
    expect(calls).toEqual([['reload']]);
  });
});

describe('restoring a link', () => {
  it('holds the address and the notices until it settles, then says what it could not apply', async () => {
    const { links, link, session } = setup();
    const hold = vi.spyOn(link, 'hold');
    const schedule = vi.spyOn(link, 'schedule');
    const notApplied = await links.restore(
      decodeState('atlas=missing&view=sideways&hemi=left'),
      {},
    );
    expect(hold).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledOnce();
    expect(notApplied).toEqual(['atlas', 'view']);
    session.notify({ text: 'Later.' });
    expect(session.state.notice).toBeNull();
    links.report(notApplied);
    expect(session.state.notice?.text).toContain('Later.');
  });

  it('returns null once a later command has taken over, and still releases its hold', async () => {
    const { links, engine, commands, link, session } = setup();
    const setHemisphere = engine.model.setHemisphere.bind(engine.model);
    engine.model.setHemisphere = (hemisphere) => {
      commands.begin();
      setHemisphere(hemisphere);
    };
    const release = vi.spyOn(link, 'release');
    expect(await links.restore(decodeState('hemi=left&cortex=0'), {})).toBeNull();
    expect(engine.model.settings.cortexVisible).toBe(true);
    expect(release).toHaveBeenCalledOnce();
    expect(() => links.report(null)).not.toThrow();
    expect(session.state.notice).toBeNull();
  });
});

describe('the scene as a link carries it', () => {
  it('keeps an oblique cut with its tilt, azimuth and direction', async () => {
    const { engine, links } = setup();
    await engine.sections.setMode('oblique');
    engine.sections.setAngles(40, -60);
    engine.sections.setDisplay({ reverse: true });
    expect(links.linkState()).toMatchObject({
      cut: 'oblique',
      cutReverse: true,
      cutTilt: 40,
      cutAzimuth: -60,
    });
  });

  it('keeps the sections’ cut atlas when the model has none yet', async () => {
    const { engine, links } = setup();
    await engine.model.setAtlas('hcp-mmp');
    expect(engine.model.state.cutAtlas).toBeNull();
    expect(links.captureReaderState().cutAtlas).toBe(engine.sections.state.cutAtlas);
  });

  it('puts back the session view of the captured scene with its exact camera pose', async () => {
    const { links, session, commands } = setup();
    session.setView('left');
    const scene = links.captureReaderState();
    session.setView('right');
    await links.applyReaderState(scene, commands.begin());
    expect(session.state.view).toBe('left');
  });

  it('puts back a captured scene: layers, display, cut, window and the exact camera pose', async () => {
    const { engine, links, commands } = setup();
    engine.model.setHemisphere('left');
    await engine.sections.setCutAtlas('hcp-mmp');
    await engine.sections.setMode('coronal');
    await engine.sections.load();
    engine.sections.setWindow(50, 60);
    engine.camera.applyView('left');
    const scene = links.captureReaderState();
    expect(scene).toMatchObject({
      cutAtlas: 'hcp-mmp',
      hemisphere: 'left',
      cut: 'coronal',
      mriWindow: { center: 50, width: 60 },
    });

    engine.model.setHemisphere('both');
    await engine.sections.setMode('off');
    engine.sections.setWindow(90, 180);
    engine.camera.applyView('right');
    const before = engine.calls.length;
    const failures = await links.applyReaderState(scene, commands.begin());
    expect(failures).toEqual([]);
    expect(engine.model.settings.hemisphere).toBe('left');
    expect(engine.sections.state.mode).toBe('coronal');
    expect(engine.sections.display).toMatchObject({ windowCenter: 50, windowWidth: 60 });
    expect(engine.calls.slice(before).filter((call) => call.method === 'restore')).toHaveLength(1);
  });
});
