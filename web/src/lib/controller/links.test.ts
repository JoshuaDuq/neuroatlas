import assert from 'node:assert/strict';
import { describe, expect, it, vi } from 'vitest';
import { createLinkWriter } from '../core/state/link-writer.ts';
import { createSceneCommands } from '../core/state/scene-commands.ts';
import { decodeState } from '../core/state/url-state.ts';
import { createFakeEngine } from '../engine/fake.ts';
import { createLessonStore, createSessionStore } from '../state/session.svelte.ts';
import { VIEW_NAMES } from '../types/index.ts';
import type { Manifest } from '../types/index.ts';
import { readRepoJson } from '../../../test/repo.ts';
import { createLinks } from './links.ts';
import type { LinkHooks } from './links.ts';

const published = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const domains = { atlas: 'none', domains: [], lesion_checks: {} };
const mri = { fieldOfView: 256, size: 64, windowCenter: 100, windowWidth: 200 };

/** Links over the fake engine, with a page that records the address bar instead of moving it. */
function setup(
  viewState: object = {},
  anatomy = published.anatomy.id,
  extras: {
    engineOptions?: object;
    circuits?: { all: unknown[]; get: (id: string) => unknown };
    hooks?: Partial<LinkHooks>;
  } = {},
) {
  const followed: string[] = [];
  const engine = createFakeEngine({ manifest: published, domains, mri, ...extras.engineOptions });
  const session = createSessionStore({ views: VIEW_NAMES });
  const lesson = createLessonStore((extras.circuits ?? { get: () => ({ steps: [{}] }) }) as never);
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
    circuits: (extras.circuits ?? { all: [], get: () => ({ steps: [] }) }) as never,
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
      ...extras.hooks,
    },
    defaultAnatomy: 'cdmd',
    followLanguage: (lang) => followed.push(lang),
    page: page as never,
  });
  return { followed, engine, session, lesson, links, page, calls, link, commands };
}

describe('writing the link', () => {
  it('LINK-02 names the language as well, in French too', () => {
    const { links, calls } = setup({ lang: 'fr' });
    links.write();
    expect(calls).toEqual([['replace', expect.stringMatching(/^#anatomy=cdmd&.*&lang=fr$/)]]);
  });

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

const LANGUAGE_CIRCUIT = {
  id: 'language',
  steps: [
    { region: 'destrieux:left:1' },
    { region: 'destrieux:left:2' },
    { region: 'destrieux:left:3' },
  ],
};
const circuits = {
  all: [LANGUAGE_CIRCUIT],
  get: (id: string) => {
    if (id !== LANGUAGE_CIRCUIT.id) throw new Error(`Unknown circuit: ${id}`);
    return LANGUAGE_CIRCUIT;
  },
};
const linkedDomains = {
  atlas: 'hcp-mmp',
  domains: [{ id: 'language' }],
  lesion_checks: {},
  search: { terms: new Map([['term-a', {}]]) },
};

/** Links for a build that publishes one function, one term, two deficits and the language circuit. */
function restorer(
  viewState: object = {},
  extras: { engineOptions?: object; hooks?: Partial<LinkHooks> } = {},
) {
  const log: string[] = [];
  const hooks: Partial<LinkHooks> = {
    chooseExplorer: (explorer) => {
      log.push(`chooseExplorer(${explorer})`);
      scene.session.setExplorer(explorer);
    },
    tractsExcursionOpen: () => false,
    forgetScenes: () => void log.push('forgetScenes'),
    rememberLessonScene: (kept) => void log.push(`rememberLessonScene(${typeof kept.camera})`),
    openLandmark: async (step) => {
      log.push(`openLandmark(${step.region})`);
      return true;
    },
    showDetail: () => void log.push('showDetail'),
    openFunction: (id) => void log.push(`openFunction(${id})`),
    openDeficit: (id) => void log.push(`openDeficit(${id})`),
    ...extras.hooks,
  };
  const scene = setup(viewState, published.anatomy.id, {
    engineOptions: { domains: linkedDomains, ...extras.engineOptions },
    circuits,
    hooks,
  });
  const restore = (hash: string) => scene.links.restore(decodeState(hash), {});
  return { ...scene, log, restore };
}

describe('the scene as a link writes it', () => {
  it('LINK-03 writes the cut mode and position, and the open lesson with its step', async () => {
    const { engine, links, calls } = restorer({ lesson: { circuit: 'language', step: 2 } });
    await engine.sections.setMode('coronal');
    engine.sections.setOffset(12.34);
    expect(links.linkState()).toMatchObject({ circuit: 'language', circuitStep: 2 });
    links.write();
    expect(calls[0]![1]).toMatch(/cut=coronal&pos=12\.3/);
  });

  it('LINK-03 writes step 0 and no cut fields without a lesson or a cut', () => {
    const { links } = restorer({ lesson: { circuit: null, step: 5 } });
    const state = links.linkState();
    expect(state).toMatchObject({ circuit: null, circuitStep: 0 });
    expect(state).not.toHaveProperty('cut');
  });
});

describe('what a link may name', () => {
  it('LINK-09 refuses a colouring, function or deficit this build does not publish', async () => {
    const { restore } = restorer();
    expect(await restore('colors=tissue&function=language&tab=functions')).toEqual([]);
    expect(await restore('colors=functional')).toEqual(['colors']);
    expect(await restore('tab=functions&function=bogus')).toEqual(['function']);
    expect(await restore('tab=deficits&deficit=bogus')).toEqual(['deficit']);
    expect(await restore('view=sideways&tab=bogus')).toEqual(['tab', 'view']);
  });

  it('LINK-09 accepts a Neurosynth term as a function', async () => {
    const { restore } = restorer();
    expect(await restore('tab=functions&function=term-a')).toEqual([]);
  });

  it('LINK-09 refuses to restore links at all in a build without neuropsychological domains', () => {
    expect(() => setup({}, published.anatomy.id, { engineOptions: { domains: null } })).toThrow(
      'This build publishes no neuropsychological domains for the Functions tab.',
    );
  });
});

describe('what failed', () => {
  it('LINK-10 names the fields that did not parse, in link order', async () => {
    const { restore } = restorer();
    expect(await restore('pos=abc&tilt=999&opacity=2&mri=1,2,3')).toEqual([
      'pos',
      'tilt',
      'opacity',
      'mri',
    ]);
  });

  it('LINK-10 names a failed cut under the cut field when the link only turns hemisphere on', async () => {
    const { restore, engine } = restorer();
    await engine.sections.setMode('coronal');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(engine.sections, 'setMode').mockRejectedValue(new Error('no cut'));
    expect(await restore('hemi=left')).toEqual(['cut']);
    expect(engine.model.settings.hemisphere).toBe('left');
  });

  it('LINK-10 names a failed cut under the fields the link named, in the step field order', async () => {
    const { restore, engine } = restorer();
    await engine.sections.setMode('coronal');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(engine.sections, 'setMode').mockRejectedValue(new Error('no cut'));
    expect(await restore('cut=coronal&pos=3&rev=1')).toEqual(['cut', 'rev', 'pos']);
  });
});

describe('what a link leaves unnamed', () => {
  it('LINK-11 puts everything it does not name back to the defaults', async () => {
    const { restore, engine, session, lesson } = restorer();
    await engine.model.setAtlas('hcp-mmp');
    engine.model.select('hcp-mmp:left:1');
    await engine.sections.setMode('coronal');
    await engine.sections.load();
    engine.sections.setWindow(50, 60);
    lesson.start('language');
    expect(await restore('hemi=right')).toEqual([]);
    expect(engine.model.settings).toMatchObject({
      atlas: 'destrieux',
      detail: 'learning',
      cutAtlas: 'destrieux',
      cutActive: false,
      hemisphere: 'right',
    });
    expect(engine.model.state.selectedRegion).toBeNull();
    expect(engine.sections.state.mode).toBe('off');
    expect(engine.sections.display).toMatchObject({ windowCenter: 100, windowWidth: 200 });
    expect(lesson.state.circuit).toBeNull();
    expect(session.state.explorer).toBe('anatomy');
  });
});

describe('the camera a link restores', () => {
  const faceCut = (engine: ReturnType<typeof setup>['engine']) =>
    vi.spyOn(engine.camera, 'faceCut');

  it.each([
    { hash: 'cut=coronal&pos=-12.5&rev=1', view: 'posterior' },
    { hash: 'cut=oblique&tilt=40&az=-60&pos=3', view: 'oblique' },
  ])('LINK-12 $hash faces the cut when no view is named', async ({ hash, view }) => {
    const { restore, engine, session } = restorer();
    // A view other than the cut's own, so the view can only come from what faceCut reports.
    session.setView('left');
    const spy = faceCut(engine);
    await restore(hash);
    expect(spy).toHaveBeenCalledOnce();
    expect(session.state.view).toBe(view);
  });

  it.each([
    { hash: 'cut=axial&view=left', view: 'left' },
    { hash: 'cut=axial&rev=1&view=superior', view: 'superior' },
  ])('LINK-12 $hash frames the view the link names', async ({ hash, view }) => {
    const { restore, engine, session } = restorer();
    const spy = faceCut(engine);
    await restore(hash);
    expect(spy).not.toHaveBeenCalled();
    expect(session.state.view).toBe(view);
  });
});

describe('the Tracts excursion and the panels', () => {
  it('LINK-13 ends the Tracts excursion before applying the display, unless the link opens Tracts', async () => {
    const { restore, engine, log } = restorer({}, { hooks: { tractsExcursionOpen: () => true } });
    const setHemisphere = engine.model.setHemisphere.bind(engine.model);
    engine.model.setHemisphere = (value) => {
      log.push('setHemisphere');
      setHemisphere(value);
    };
    await restore('tab=anatomy&hemi=left');
    expect(log.filter((line) => line !== 'forgetScenes')).toEqual([
      'chooseExplorer(anatomy)',
      'setHemisphere',
      'chooseExplorer(anatomy)',
    ]);
    log.length = 0;
    await restore('tab=diffusion&hemi=right');
    expect(log).toEqual(['setHemisphere', 'forgetScenes', 'chooseExplorer(diffusion)']);
  });

  it('LINK-14 opens the tab, function and lesson the link names once the scene is applied', async () => {
    const { restore, session, lesson, log } = restorer();
    expect(await restore('tab=functions&function=language')).toEqual([]);
    expect(session.state).toMatchObject({
      explorer: 'functions',
      selectedFunction: 'language',
      selectedDeficit: null,
    });
    expect(lesson.state.circuit).toBeNull();
    expect(log).toContain('forgetScenes');
    expect(await restore('tab=circuits&circuit=language&step=2')).toEqual([]);
    expect(lesson.state).toMatchObject({ circuit: 'language', step: 1 });
    expect(session.state.selectedFunction).toBeNull();
  });

  it('LINK-14 opens a deficit, and says a circuit the build lacks was not applied, closing the lesson', async () => {
    const { restore, session, lesson } = restorer();
    await restore('tab=deficits&deficit=aphasia');
    expect(session.state).toMatchObject({ explorer: 'deficits', selectedDeficit: 'aphasia' });
    expect(await restore('tab=circuits&circuit=bogus&step=9')).toEqual(['circuit', 'step']);
    expect(lesson.state.circuit).toBeNull();
  });

  it('LINK-15 opens a lesson linked without its landmark on that landmark, keeping the scene first', async () => {
    const { restore, log } = restorer();
    await restore('tab=circuits&circuit=language&step=2');
    expect(log.filter((line) => /^(remember|openLandmark)/.test(line))).toEqual([
      'rememberLessonScene(object)',
      'openLandmark(destrieux:left:2)',
    ]);
  });

  it('LINK-15 reports step when the landmark fails, and leaves a landmark the link names alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = restorer(
      {},
      {
        hooks: {
          openLandmark: async () => {
            throw new Error('not drawn');
          },
        },
      },
    );
    expect((await failing.restore('tab=circuits&circuit=language&step=2'))!.at(-1)).toBe('step');
    const named = restorer();
    await named.restore('tab=circuits&circuit=language&step=2&region=destrieux:left:1');
    expect(named.log.some((line) => line.startsWith('openLandmark'))).toBe(false);
  });

  it('LINK-15 returns null when a later command overtakes the landmark', async () => {
    const { restore } = restorer({}, { hooks: { openLandmark: async () => false } });
    expect(await restore('tab=circuits&circuit=language&step=2')).toBeNull();
  });

  it('LINK-16 shows the detail without an atlas-less item being left unopened', async () => {
    const { restore, log } = restorer();
    await restore('tab=functions&function=language');
    expect(log.filter((line) => /^(showDetail|open)/.test(line))).toEqual([
      'showDetail',
      'openFunction(language)',
    ]);
    log.length = 0;
    await restore('tab=functions&function=language&atlas=destrieux');
    expect(log.filter((line) => /^(showDetail|open)/.test(line))).toEqual(['showDetail']);
    log.length = 0;
    await restore('tab=deficits&deficit=aphasia&atlas=destrieux');
    expect(log.filter((line) => /^(showDetail|open)/.test(line))).toEqual(['showDetail']);
    log.length = 0;
    await restore('tab=deficits&deficit=aphasia');
    expect(log.filter((line) => /^(showDetail|open)/.test(line))).toEqual([
      'showDetail',
      'openDeficit(aphasia)',
    ]);
    log.length = 0;
    await restore('tab=anatomy');
    expect(log.filter((line) => /^(showDetail|open)/.test(line))).toEqual([]);
  });
});
