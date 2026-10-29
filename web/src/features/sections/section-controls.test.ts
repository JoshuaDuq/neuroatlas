// The plane choice, the slider queue and the Linked MRI opener against legacy ui/chrome/sections.js:138-247,
// over the fake engine.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import type { CutMode, Manifest } from '../../lib/types/index.ts';
import { createSectionControls } from './section-controls.svelte.ts';
import type { SectionControlsDeps } from './section-controls.svelte.ts';

const published = manifest as unknown as Manifest;

/** A promise the test settles. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let engine: FakeEngine;
let setView: ReturnType<typeof vi.fn<(view: string) => boolean>>;
let openLinkedMri: ReturnType<typeof vi.fn<SectionControlsDeps['openLinkedMri']>>;
let cut: ReturnType<typeof vi.fn<(plane: CutMode, current: () => boolean) => Promise<boolean>>>;

function build() {
  const engineState = createEngineSync(engine);
  return createSectionControls({
    engine,
    engineState,
    commands: { begin: () => () => true, cut },
    session: { setView },
    openLinkedMri,
  });
}

beforeEach(() => {
  engine = createFakeEngine({ manifest: published });
  setView = vi.fn(() => true);
  openLinkedMri = vi.fn(async () => {});
  cut = vi.fn(async (plane: CutMode) => {
    await engine.sections.setMode(plane);
    return true;
  });
});

afterEach(() => vi.restoreAllMocks());

const calls = (method: string) =>
  engine.calls.filter((call) => call.domain === 'sections' && call.method === method);

describe('choosing a plane', () => {
  test('names it at once while its anatomy is prepared, then faces the cut', async () => {
    const landed = deferred<boolean>();
    cut.mockImplementationOnce(async (plane) => {
      await engine.sections.setMode(plane);
      return landed.promise;
    });
    const controls = build();
    const choosing = controls.choose('coronal');
    expect(controls.plane).toBe('coronal');
    expect(controls.pending).toBe(true);
    landed.resolve(true);
    await choosing;
    expect(controls.pending).toBe(false);
    expect(controls.state.mode).toBe('coronal');
    expect(calls('setMode').map((call) => call.args[0])).toEqual(['coronal']);
    expect(engine.calls.some((call) => call.method === 'faceCut')).toBe(true);
    expect(setView).toHaveBeenCalledWith('anterior');
  });

  test('meets the region already selected rather than the midline', async () => {
    const region = published.regions.find(
      (r) => r.atlas === engine.model.state.atlas && r.kind === 'cortex' && r.hemisphere === 'left',
    )!;
    engine.model.select(region.id);
    const controls = build();
    await controls.choose('sagittal');
    expect(controls.offset).toBe(engine.model.anchorOf(region.id)![0]);
    expect(controls.offset).not.toBe(0);
  });

  test('the plane already on screen, or already being prepared, is not cut again', async () => {
    const controls = build();
    await controls.choose('off');
    expect(cut).not.toHaveBeenCalled();
    const landed = deferred<boolean>();
    cut.mockImplementationOnce(() => landed.promise);
    const first = controls.choose('axial');
    await controls.choose('axial');
    expect(cut).toHaveBeenCalledTimes(1);
    landed.resolve(false);
    await first;
  });

  test('a plane chosen while another is prepared overtakes it; only the newer one faces its cut', async () => {
    const sagittal = deferred<boolean>();
    cut.mockImplementationOnce(() => sagittal.promise);
    const controls = build();
    const first = controls.choose('sagittal');
    const second = controls.choose('axial');
    expect(controls.plane).toBe('axial');
    await second;
    sagittal.resolve(true);
    await first;
    expect(controls.state.mode).toBe('axial');
    expect(setView.mock.calls).toEqual([['superior']]);
    expect(controls.pending).toBe(false);
  });

  test('a cut that fails is said, and leaves no plane pending', async () => {
    const error = new Error('cut failed');
    cut.mockRejectedValueOnce(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const controls = build();
    await controls.choose('coronal');
    expect(controls.pending).toBe(false);
    expect(controls.plane).toBe('off');
    expect(controls.failure).toBe(error);
    expect(logged).toHaveBeenCalledWith(error);
    // The next change of the cut replaces the failure, as the next render did in legacy.
    await engine.sections.setMode('axial');
    expect(controls.failure).toBeNull();
  });
});

test('Close goes back to the whole brain and forgets a plane being prepared', async () => {
  const controls = build();
  await controls.choose('axial');
  cut.mockImplementationOnce(() => new Promise(() => {}));
  void controls.choose('coronal');
  await controls.close();
  expect(controls.pending).toBe(false);
  expect(controls.state.mode).toBe('off');
  expect(controls.current).toBeNull();
});

test('the slider builds one cut at a time and skips to the newest value', async () => {
  const controls = build();
  await controls.choose('axial');
  const first = deferred();
  const original = engine.sections.setOffsetReady.bind(engine.sections);
  const ready = vi
    .spyOn(engine.sections, 'setOffsetReady')
    .mockImplementationOnce(async (offset) => {
      await first.promise;
      return original(offset);
    });
  controls.slideOffset(5);
  controls.slideOffset(6);
  controls.slideOffset(7);
  expect(ready.mock.calls).toEqual([[5]]);
  first.resolve();
  await vi.waitFor(() => expect(ready.mock.calls).toEqual([[5], [7]]));
  await vi.waitFor(() => expect(controls.offset).toBe(7));
});

describe('choosing again before a download ends', () => {
  test('Axial, Full brain, Axial: the first Axial settling does not end the second one’s preparation', async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    const controls = build();
    cut.mockImplementationOnce(() => first.promise);
    const choosingFirst = controls.choose('axial');
    await controls.choose('off');
    cut.mockImplementationOnce(async (plane) => {
      await second.promise;
      await engine.sections.setMode(plane);
      return true;
    });
    const choosingSecond = controls.choose('axial');
    first.resolve(false);
    await choosingFirst;
    expect(controls.plane).toBe('axial');
    expect(controls.pending).toBe(true);
    second.resolve(true);
    await choosingSecond;
    expect(controls.pending).toBe(false);
    expect(controls.state.mode).toBe('axial');
  });
});

describe('the slide queue after a failure', () => {
  test('a rejected build is said, and the next slide still runs', async () => {
    const controls = build();
    await controls.choose('axial');
    const error = new Error('build failed');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ready = vi.spyOn(engine.sections, 'setOffsetReady').mockRejectedValueOnce(error);
    controls.slideOffset(5);
    await vi.waitFor(() => expect(controls.failure).toBe(error));
    // Acting on the section again replaces the failure, with the mode unchanged.
    controls.slideOffset(6);
    expect(controls.failure).toBeNull();
    await vi.waitFor(() => expect(controls.offset).toBe(6));
    expect(ready.mock.calls).toEqual([[5], [6]]);
  });
});

test('Reverse side keeps the other half and turns the camera to face it', async () => {
  const controls = build();
  await controls.choose('coronal');
  controls.setReverse(true);
  expect(controls.state.reverse).toBe(true);
  expect(setView).toHaveBeenLastCalledWith('posterior');
});

test('the exact field moves the cut directly', async () => {
  const controls = build();
  await controls.choose('axial');
  for (const value of [-12.5, 0, 18.75]) controls.setOffset(value);
  expect(calls('setOffset').map((call) => call.args[0])).toEqual([-12.5, 0, 18.75]);
});

describe('Linked MRI', () => {
  test('passes on how it was opened, and a second press while it loads does nothing', async () => {
    const loaded = deferred();
    openLinkedMri.mockImplementationOnce(() => loaded.promise);
    const controls = build();
    const opening = controls.openLinkedMri({ instant: true });
    expect(controls.opening).toBe(true);
    await controls.openLinkedMri({ instant: false });
    expect(openLinkedMri.mock.calls).toEqual([[{ instant: true }]]);
    loaded.resolve();
    await opening;
    expect(controls.opening).toBe(false);
    await controls.openLinkedMri({ instant: false });
    expect(openLinkedMri.mock.calls).toEqual([[{ instant: true }], [{ instant: false }]]);
  });

  test('a failure to open is said, and the opener is free again', async () => {
    const error = new Error('no scan');
    openLinkedMri.mockRejectedValueOnce(error);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const controls = build();
    await controls.openLinkedMri({ instant: false });
    expect(controls.failure).toBe(error);
    expect(controls.opening).toBe(false);
  });
});

test('the caption gives the cut on screen, and nothing while one is prepared', async () => {
  const controls = build();
  expect(controls.current).toBeNull();
  await controls.choose('oblique');
  expect(controls.current).toEqual({ plane: 'oblique', offset: 0, tilt: 30, azimuth: 30 });
  cut.mockImplementationOnce(() => new Promise(() => {}));
  void controls.choose('axial');
  expect(controls.current).toBeNull();
});

test('the cut labels are the manifest’s, and NextBrain is known to be segmented on this brain', () => {
  const controls = build();
  expect(controls.cutAtlases.map((atlas) => atlas.id)).toEqual([
    'destrieux',
    'hcp-mmp',
    'julich',
    'schaefer',
    'nextbrain',
    'arterial',
    'nettekoven',
  ]);
  expect(controls.nextbrainSegmented).toBe(true);
});
