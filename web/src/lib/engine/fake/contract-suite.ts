import { assert } from './assert.ts';
import { afterAll, afterEach, beforeAll, describe, it, onTestFinished, vi } from 'vitest';
import type { Region } from '../../types/index.ts';
import type { Engine, EngineEvents, MriLocation, SectionsState, Vec3 } from '../api.ts';

export interface ContractFixtures {
  /** The canvas `tracts.createMriNavigator` draws on; the fake ignores it. Omit to skip that case. */
  canvas?: HTMLCanvasElement;
  /** An overlap the atlas comparison can outline, with its geometry file; omit to skip those cases. */
  comparison?: { id: string; geometry: { file: string; sha256: string } };
  /** Draw the next frame, for a stage whose loop does not run on its own (a test without a GPU). */
  drawFrame?: () => void;
}

const codeOf = (error: unknown) => (error as { code?: string }).code;
const rejectsWith = (code: string) => (error: unknown) => codeOf(error) === code;

/** A refusal with this code and this exact message. */
const refusal = (code: string, message: string) => (error: unknown) =>
  codeOf(error) === code && (error as Error).message === message;

const exactly = (message: string) =>
  new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** The call throws this kind of error, with exactly this message. */
function refuses(run: () => unknown, kind: ErrorConstructor, message: string) {
  assert.throws(run, kind);
  assert.throws(run, exactly(message));
}

const near = (actual: readonly number[], expected: readonly number[], tolerance = 1e-9) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, axis) =>
    assert.ok(Math.abs(value - expected[axis]!) <= tolerance, `${actual} is not ${expected}`),
  );
};

const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, value, axis) => sum + value * b[axis]!, 0);

/** Collect an event's payloads until the test ends. */
function collect<K extends keyof EngineEvents>(engine: Engine, type: K) {
  const events: EngineEvents[K][] = [];
  onTestFinished(engine.on(type, (event) => events.push(event)));
  return events;
}

/** Regions of the published manifest, as the contract finds them for the engine it is given. */
async function bootWorld(create: () => Promise<Engine> | Engine) {
  const engine = await create();
  const { manifest, regions } = engine.model;
  const [atlas, otherAtlas] = manifest.atlases.map((entry) => entry.id) as [string, string];
  const cortex = (side: 'left' | 'right', inAtlas = atlas) =>
    manifest.regions.find(
      (region) =>
        region.kind === 'cortex' && region.atlas === inAtlas && region.hemisphere === side,
    ) as Region;
  return {
    engine,
    regions,
    atlas,
    otherAtlas,
    cortex,
    left: cortex('left'),
    right: cortex('right'),
  };
}
type World = Awaited<ReturnType<typeof bootWorld>>;

/** The part of the cut a case can change and a reader sees. */
const cutOf = ({ mode, cutAtlas, crosshair, reverse, overlay, tilt, azimuth }: SectionsState) => ({
  mode,
  cutAtlas,
  crosshair,
  reverse,
  overlay,
  tilt,
  azimuth,
});

/** The model's settings; its cut atlas only follows an open cut, which the cut's own state carries. */
const modelOf = (engine: Engine) => ({ ...engine.model.settings, cutAtlas: null });

/** What a freshly opened engine shows, read before the first case of a shared boot. */
function openingOf(engine: Engine) {
  return {
    settings: structuredClone(modelOf(engine)),
    cut: structuredClone(cutOf(engine.sections.state)),
  };
}
type Opening = ReturnType<typeof openingOf>;

/**
 * Put a shared engine's model and cut back to their opening state through the public API alone, and prove
 * the model's settings and the cut are there. The camera, the tracts' settings and the MRI window are not asserted.
 * What a case downloaded stays downloaded: a layer, the volumes, the tracts, the cord.
 */
async function restore(engine: Engine, opening: Opening) {
  const { model, sections, camera, comparison, tracts } = engine;
  const cut = cutOf(sections.state);
  if (cut.cutAtlas !== opening.cut.cutAtlas) await sections.setCutAtlas(opening.cut.cutAtlas);
  if (cut.mode !== 'off') await sections.setMode('off');
  sections.setCrosshair(opening.cut.crosshair);
  sections.setAngles(opening.cut.tilt, opening.cut.azimuth);
  sections.setDisplay({ reverse: opening.cut.reverse, overlay: opening.cut.overlay });
  if (model.settings.atlas !== opening.settings.atlas) await model.setAtlas(opening.settings.atlas);
  if (model.settings.detail !== opening.settings.detail) {
    await model.setDetail(opening.settings.detail);
  }
  model.reset();
  model.setPaint(null);
  camera.setFramingSource(() => ({ inset: {}, scale: { horizontal: 1, vertical: 1 } }));
  camera.setChromeInsets({}, { settle: false });
  camera.applyView('oblique', { immediate: true });
  engine.applyTheme('light');
  engine.present({ lang: 'en', referenceOnly: false });
  comparison.clear();
  comparison.setVisible(true);
  if (tracts.ready) await tracts.setActive(false);
  assert.deepEqual(
    modelOf(engine),
    opening.settings,
    "the model's settings are back to their opening state",
  );
  assert.deepEqual(cutOf(sections.state), opening.cut, 'the cut is back to its opening state');
}

/** The camera, the opening, the cut and the navigator: what the real stage must show on real WebGL. */
function opensOnTheFirstAtlas({ engine, atlas }: World) {
  const { settings, state } = engine.model;
  assert.equal(settings.atlas, atlas);
  assert.equal(settings.detail, engine.model.defaultDetail);
  assert.ok(engine.model.hasLayer(atlas) && engine.model.hasLayer(settings.detail));
  assert.equal(state.selectedRegion, null);
  assert.equal(settings.hemisphere, 'both');
  assert.equal(settings.cortexVisible, true);
  assert.equal(settings.cortexOpacity, 1);
  assert.equal(settings.paint, null);
  assert.equal(settings.dissectionCanUndo, false);
  assert.equal(typeof state.visibleMeshCount, 'number');
}

async function cutsReportingThePlane({ engine }: World) {
  const { sections, model } = engine;
  const changes = collect(engine, 'change');
  assert.equal(sections.active, false);
  await assert.rejects(sections.setMode('diagonal' as never), /Unknown cut mode/);
  await sections.setMode('coronal');
  // The slider's path builds the cut in the worker where there is one.
  await sections.setOffsetReady(10);
  assert.ok(Math.abs(sections.offset - 10) < 1e-9);
  assert.equal(sections.state.mode, 'coronal');
  assert.equal(sections.active, true);
  assert.equal(model.settings.cutActive, true);
  assert.equal(model.settings.cutAtlas, sections.state.cutAtlas);
  assert.equal(changes.at(-1)?.sections.mode, 'coronal');
  await sections.setMode('off');
  assert.equal(model.settings.cutActive, false);
}

async function opensTheMriNavigator({ engine }: World, canvas: HTMLCanvasElement) {
  const locations: MriLocation[] = [];
  const navigator = await engine.tracts.createMriNavigator(canvas, (location) =>
    locations.push(location),
  );
  onTestFinished(() => navigator.dispose());
  const { dims } = navigator.header;
  // The report is the source voxel asked for, and the last one: a mirrored axis changes nothing.
  navigator.setVoxel([5, 6, 7]);
  assert.deepEqual(locations.at(-1)?.vox, [5, 6, 7]);
  assert.ok(locations.every((location) => location.values.length > 0));
  assert.throws(() => navigator.setVoxel([dims[1]!, 0, 0]), RangeError);
  assert.throws(() => navigator.setVoxel([0.5, 0, 0]), RangeError);
  // A step runs in the display's direction, so a mirrored source axis steps down: one voxel, one axis.
  navigator.moveVoxel([1, 0, 0]);
  const [x, y, z] = locations.at(-1)!.vox;
  assert.deepEqual([Math.abs(x - 5), y, z], [1, 6, 7]);
  assert.equal(locations.at(-1)?.mm.length, 3);
  assert.throws(() => navigator.setPlane('OBLIQUE' as never), RangeError);
  navigator.setPlane('AXIAL');
  assert.throws(() => navigator.setWindow(0, 0), RangeError);
  navigator.setWindow(0.5, 1);
  assert.equal(navigator.setScannerPoint([1e6, 0, 0]), false);
  await assert.rejects(navigator.syncTracts([], 0), RangeError);
  await navigator.syncTracts([], 1);
  navigator.dispose();
}

/** One engine for the cases of a `describe`, has its model and cut put back to their opening state after each. */
function sharedEngine(create: () => Promise<Engine> | Engine) {
  let world: World | null = null;
  let opening: Opening | null = null;
  beforeAll(async () => {
    world = await bootWorld(create);
    opening = openingOf(world.engine);
  });
  afterEach(async () => {
    await restore(world!.engine, opening!);
  });
  afterAll(() => {
    world?.engine.dispose();
  });
  return () => world!;
}

/** An engine of its own, for a case that needs the engine as it opens. */
function freshEngine(create: () => Promise<Engine> | Engine) {
  return async () => {
    const world = await bootWorld(create);
    onTestFinished(() => world.engine.dispose());
    return world;
  };
}

/**
 * The behaviour every implementation of `Engine` must show: the in-memory fake (`contract.test.ts`) and
 * the real engine (`index.contract.test.ts`, on the real scene with a renderer that draws nothing). It
 * reads everything it needs from the engine's own manifest, so it holds for any published anatomy that has
 * two cortical atlases, the learning detail level and CAB-NP.
 *
 * The cases of a group share one engine and have their model and cut put back to their opening state after each; the cases that
 * assert what has not been downloaded yet ("first use") run in order on one engine, and the few that
 * cannot share it get their own. `captureSnapshot` needs a canvas and a frame, so each implementation
 * tests it where it can draw (`defineStageContract`).
 */
export function defineEngineContract(
  name: string,
  create: () => Promise<Engine> | Engine,
  fixtures: ContractFixtures,
) {
  const fresh = freshEngine(create);

  describe(`engine contract: ${name}`, () => {
    // Order matters here: each case asserts something that no earlier case has downloaded.
    describe('first use', () => {
      const world = sharedEngine(create);

      it('opens on the first atlas and the default detail level', () => {
        opensOnTheFirstAtlas(world());
      });

      it('reports centroids in RAS millimetres only for geometry it has', () => {
        const { engine, left, cortex, otherAtlas } = world();
        assert.equal(engine.model.centroidOf(null), null);
        const centre = engine.model.centroidOf(left.id);
        assert.ok(centre && centre.length === 3 && centre.every(Number.isFinite));
        assert.ok(
          centre.every((value) => value !== 0),
          'a centroid lies off every plane through the origin',
        );
        assert.equal(engine.model.centroidOf(cortex('left', otherAtlas).id), null);
        assert.equal(engine.model.isRegionDrawn(left.id), true);
        assert.equal(engine.model.isRegionDrawn(cortex('left', otherAtlas).id), false);
      });

      it('prefetches a layer without changing the display', async () => {
        const { engine, otherAtlas, atlas } = world();
        assert.equal(engine.model.hasLayer(otherAtlas), false);
        await engine.model.prefetchLayer(otherAtlas);
        assert.ok(engine.model.hasLayer(otherAtlas));
        assert.equal(engine.model.settings.atlas, atlas);
      });

      it('downloads the envelopes on request', async () => {
        const { engine } = world();
        assert.equal(engine.model.envelopesLoaded, false);
        await engine.model.ensureEnvelopes();
        assert.equal(engine.model.envelopesLoaded, true);
      });

      it('refuses to prefetch what is not an atlas or a detail level', async () => {
        const { engine } = world();
        // A supplemental layer loads with its own command (the E4b review).
        await assert.rejects(engine.model.prefetchLayer('pam50'), rejectsWith('unknown-layer'));
        await assert.rejects(
          engine.model.prefetchLayer('no-such-layer'),
          rejectsWith('unknown-layer'),
        );
        assert.equal(engine.model.hasLayer('pam50'), false);
      });

      it('downloads the spinal cord on first showing', async () => {
        const { engine } = world();
        const { model } = engine;
        assert.notEqual(model.spinalCordLoad, 'ready');
        await assert.rejects(model.setSpinalCordVisible('yes' as never), TypeError);
        await model.setSpinalCordVisible(true);
        assert.equal(model.spinalCordLoad, 'ready');
        assert.equal(model.settings.spinalCordVisible, true);
        await model.setSpinalCordVisible(false);
        assert.equal(model.settings.spinalCordVisible, false);
      });

      it('serves the linked MRI once loaded', async () => {
        const { sections } = world().engine;
        assert.equal(sections.volumesLoaded, false);
        assert.equal(sections.display, null);
        assert.equal(sections.mriWindowLink(), null);
        assert.throws(() => sections.setWindow(100, 200), RangeError);
        await sections.load();
        assert.equal(sections.volumesLoaded, true);
        const display = sections.display!;
        const published = sections.publishedWindow!;
        assert.deepEqual(published, { center: display.windowCenter, width: display.windowWidth });
        assert.equal(sections.mriWindowLink(), null, 'the published window is not a link field');
        assert.throws(() => sections.setWindow(100, 0), RangeError);
        sections.setWindow(published.center + 10, published.width + 20);
        assert.deepEqual(sections.mriWindowLink(), {
          center: published.center + 10,
          width: published.width + 20,
        });
        sections.setWindow(published.center, published.width);
        assert.equal(sections.mriWindowLink(), null);
      });

      it('loads the tracts on first opening and says so', async () => {
        const { engine } = world();
        const { tracts } = engine;
        const ready = collect(engine, 'tractsReady');
        const visibility = collect(engine, 'tractsVisibility');
        assert.equal(tracts.ready, false);
        assert.equal(typeof tracts.anatomy, 'string');
        assert.ok(tracts.defaultOpacity > 0 && tracts.defaultOpacity < 1);
        await tracts.setActive(true);
        assert.equal(tracts.ready, true);
        assert.equal(ready.length, 1);
        await tracts.setActive(false);
        await tracts.setActive(true);
        assert.equal(ready.length, 1, 'the reference loads once');
        const [first] = tracts.snapshot();
        assert.ok(first, 'the catalog opens with bundles');
        assert.equal(tracts.hasBundle(first.id), true);
        tracts.setVisible(first.id, false);
        assert.equal(tracts.snapshot()[0]!.visible, false);
        assert.ok(visibility.length > 0);
        assert.throws(() => tracts.setVisible('no-such-bundle', true), RangeError);
      });
    });

    describe('events', () => {
      const world = sharedEngine(create);

      it('unsubscribes', () => {
        const { engine, left } = world();
        const seen: unknown[] = [];
        const off = engine.on('change', (event) => seen.push(event));
        engine.model.select(left.id);
        const count = seen.length;
        assert.ok(count > 0);
        off();
        engine.model.select(null);
        assert.equal(seen.length, count);
      });
    });

    describe('model', () => {
      const world = sharedEngine(create);

      it('selects a visible region, reports it in a change, and clears it', () => {
        const { engine, left } = world();
        const changes = collect(engine, 'change');
        engine.model.select(left.id);
        assert.equal(engine.model.state.selectedRegion?.id, left.id);
        assert.equal(changes.at(-1)?.model.selectedRegion?.id, left.id);
        engine.model.select(null);
        assert.equal(engine.model.state.selectedRegion, null);
      });

      it('refuses an unknown, non-region or hidden selection', () => {
        const { engine, cortex, otherAtlas } = world();
        const { manifest } = engine.model;
        const otherCortex = cortex('left', otherAtlas);
        assert.throws(() => engine.model.select('no-such-region'), /Unknown region/);
        const nonRegion = manifest.regions.find((region) => region.kind === 'non-region')!;
        assert.throws(() => engine.model.select(nonRegion.id), /non-region/);
        assert.throws(() => engine.model.select(otherCortex.id), /not visible/);
      });

      it('words each refusal, and a refused command changes nothing', async () => {
        const { engine, left, cortex, otherAtlas } = world();
        const { model } = engine;
        const nonRegion = model.manifest.regions.find((region) => region.kind === 'non-region')!;
        const notDrawn = cortex('left', otherAtlas);
        model.select(left.id);
        const before = model.settings;
        const changes = collect(engine, 'change');
        refuses(() => model.select('missing'), Error, 'Unknown region: missing');
        refuses(
          () => model.select(nonRegion.id),
          Error,
          `Cannot select a non-region: ${nonRegion.id}`,
        );
        refuses(() => model.select(notDrawn.id), Error, `Region is not visible: ${notDrawn.id}`);
        refuses(() => model.setHemisphere('up' as never), Error, 'Invalid hemisphere: up');
        refuses(
          () => model.setCortexVisible('yes' as never),
          TypeError,
          'Cortex visibility must be boolean.',
        );
        refuses(
          () => model.setInternalVisible(0 as never),
          TypeError,
          'Internal anatomy visibility must be boolean.',
        );
        for (const opacity of [1.1, -0.1, Number.NaN]) {
          refuses(
            () => model.setCortexOpacity(opacity),
            RangeError,
            'Cortex opacity must be between 0 and 1.',
          );
        }
        refuses(
          () => model.setSurfaceColor('bogus' as never),
          TypeError,
          'Unknown surface colour: bogus',
        );
        for (const paint of [
          { id: 5, colors: new Map() },
          { id: 'x', colors: {} },
        ]) {
          refuses(
            () => model.setPaint(paint as never),
            TypeError,
            'A paint needs an id and a Map of region colours.',
          );
        }
        refuses(
          () => model.setInternalSystem('Imaginary system'),
          Error,
          'Unknown internal anatomy system: Imaginary system',
        );
        refuses(() => model.hideRegions(['missing']), Error, 'Unknown region: missing');
        await assert.rejects(model.setSpinalCordVisible('yes' as never), TypeError);
        await assert.rejects(
          model.setSpinalCordVisible('yes' as never),
          exactly('Spinal cord visibility must be boolean.'),
        );
        await assert.rejects(
          model.setAtlas('missing'),
          refusal('unknown-layer', 'Unknown atlas: missing'),
        );
        await assert.rejects(
          model.setDetail('missing'),
          refusal('unknown-layer', 'Unknown detail level: missing'),
        );
        assert.equal(model.state.selectedRegion?.id, left.id, 'a refusal leaves the selection');
        assert.deepEqual(model.settings, before);
        assert.equal(changes.length, 0, 'a refusal reports nothing');
        model.select(null);
        refuses(() => model.isolate(), Error, 'Select a region before isolating.');
      });

      it('drops a selection the settings no longer show', () => {
        const { engine, right } = world();
        engine.model.select(right.id);
        engine.model.setHemisphere('left');
        assert.equal(engine.model.state.selectedRegion, null);
      });

      it('validates its setters', () => {
        const { model } = world().engine;
        assert.throws(() => model.setHemisphere('up' as never));
        assert.throws(() => model.setCortexOpacity(1.5), RangeError);
        assert.throws(() => model.setCortexOpacity(Number.NaN), RangeError);
        assert.throws(() => model.setCortexVisible('yes' as never), TypeError);
        assert.throws(() => model.setInternalVisible(1 as never), TypeError);
        assert.throws(
          () => model.setInternalSystem('No such system'),
          /Unknown internal anatomy system/,
        );
        assert.throws(() => model.setPaint({ id: 'x', colors: {} } as never), TypeError);
      });

      it('refuses to select a cortical region once the cortex is transparent', () => {
        const { engine, left } = world();
        engine.model.setCortexOpacity(0);
        assert.throws(() => engine.model.select(left.id), /not visible/);
      });

      // Published CDMD, learning detail: 256 regions drawn, 150 of them cortex and 106 internal; a
      // hemisphere shows its own and the midline.
      it('draws the regions each hemisphere, cortex and internal setting shows', () => {
        const { engine, regions } = world();
        const { model } = engine;
        const drawn = () => [...regions.keys()].filter((id) => model.isRegionDrawn(id));
        const expected = {
          both: { both: 256, cortex: 150, internal: 106, neither: 0 },
          left: { both: 133, cortex: 75, internal: 58, neither: 0 },
          right: { both: 133, cortex: 75, internal: 58, neither: 0 },
        } as const;
        for (const hemisphere of ['both', 'left', 'right'] as const) {
          for (const [setting, cortex, internal] of [
            ['both', true, true],
            ['cortex', true, false],
            ['internal', false, true],
            ['neither', false, false],
          ] as const) {
            model.setHemisphere(hemisphere);
            model.setCortexVisible(cortex);
            model.setInternalVisible(internal);
            const label = `${hemisphere}, cortex ${cortex}, internal ${internal}`;
            assert.equal(drawn().length, expected[hemisphere][setting], label);
            assert.equal(model.state.visibleMeshCount, expected[hemisphere][setting], label);
          }
        }
        model.reset();
        model.setHemisphere('left');
        const ids = drawn().map((id) => regions.get(id)!);
        assert.ok(ids.every((region) => region.hemisphere !== 'right'));
        const midline = [...regions.values()].filter(
          (region) => region.atlas === 'learning' && region.hemisphere === 'midline',
        );
        assert.ok(midline.length > 0 && midline.every((region) => ids.includes(region)));
      });

      it('isolates the selection and releases it on a setting change', () => {
        const { engine, left } = world();
        assert.throws(() => engine.model.isolate(), /Select a region/);
        engine.model.select(left.id);
        engine.model.isolate();
        assert.equal(engine.model.settings.isolatedRegion, left.id);
        engine.model.clearIsolation();
        assert.equal(engine.model.settings.isolatedRegion, null);
        engine.model.isolate();
        engine.model.setHemisphere('both');
        assert.equal(engine.model.settings.isolatedRegion, null);
      });

      it('shows the isolated region alone, and only what is shown releases it', async () => {
        const { engine, left } = world();
        const { model } = engine;
        const system = model.manifest.regions.find(
          (region) => region.kind === 'structure' && region.atlas === 'learning',
        )!.system_names!.en!;
        model.select(left.id);
        model.isolate();
        assert.equal(model.state.visibleMeshCount, 1);
        // Opacity, colour and paint leave it be.
        model.setCortexOpacity(0.5);
        model.setSurfaceColor('tissue');
        model.setPaint({ id: 'function:test', colors: new Map([[left.id, [1, 2, 3] as const]]) });
        assert.equal(model.settings.isolatedRegion, left.id);
        model.clearIsolation();
        assert.equal(model.state.selectedRegion?.id, left.id, 'releasing keeps the selection');
        assert.equal(model.settings.cortexOpacity, 0.5, 'and every other setting');
        assert.equal(model.state.visibleMeshCount, 256);
        model.reset();
        model.setPaint(null);
        const releasers: [string, () => unknown][] = [
          ['hemisphere', () => model.setHemisphere('left')],
          ['cortex', () => model.setCortexVisible(false)],
          ['internal anatomy', () => model.setInternalVisible(false)],
          ['internal system', () => model.setInternalSystem(system)],
          ['spinal cord', () => model.setSpinalCordVisible(true)],
        ];
        for (const [what, change] of releasers) {
          model.select(left.id);
          model.isolate();
          assert.equal(model.settings.isolatedRegion, left.id, what);
          await change();
          assert.equal(model.settings.isolatedRegion, null, `a change of the ${what} releases it`);
          model.reset();
        }
      });

      it('paints by id, and the same id is not a change', () => {
        const { engine, left } = world();
        const changes = collect(engine, 'change');
        const paint = { id: 'function:test', colors: new Map([[left.id, [1, 2, 3] as const]]) };
        engine.model.setPaint(paint);
        assert.equal(engine.model.settings.paint?.id, 'function:test');
        const count = changes.length;
        engine.model.setPaint({ ...paint });
        assert.equal(changes.length, count);
        engine.model.setPaint(null);
        assert.equal(engine.model.settings.paint, null);
      });

      it('keeps the surface colour under a paint, replaces it by id and lifts it with null', () => {
        const { model } = world().engine;
        const { left, right } = world();
        model.setSurfaceColor('tissue');
        model.setPaint({
          id: 'deficit:aphasia',
          colors: new Map([[left.id, [255, 0, 0] as const]]),
        });
        assert.equal(model.settings.paint?.id, 'deficit:aphasia');
        assert.equal(model.settings.surfaceColor, 'tissue', 'the colour stays underneath');
        model.setPaint({
          id: 'deficit:other',
          colors: new Map([[right.id, [0, 255, 0] as const]]),
        });
        assert.equal(model.settings.paint?.id, 'deficit:other', 'a paint is replaced whole');
        model.setPaint(null);
        assert.equal(model.settings.paint, null);
        assert.equal(model.settings.surfaceColor, 'tissue');
      });

      it('dissects with one history entry per action, and undoes them', () => {
        const { engine, left, right } = world();
        const { model } = engine;
        model.select(left.id);
        model.hideRegions([left.id]);
        assert.ok(model.settings.hiddenRegions.has(left.id));
        assert.equal(model.settings.dissectionCanUndo, true);
        assert.equal(model.state.selectedRegion, null);
        model.hideRegions([left.id]);
        model.hideRegions([right.id]);
        model.undoDissection();
        assert.deepEqual([...model.settings.hiddenRegions], [left.id]);
        model.undoDissection();
        assert.equal(model.settings.hiddenRegions.size, 0);
        assert.equal(model.settings.dissectionCanUndo, false);
        const restored = model.state.selectedRegion as Region | null;
        assert.equal(restored?.id, left.id, 'undo restores the selection it hid');
        assert.throws(() => model.hideRegions(['no-such-region']), /Unknown region/);
      });

      it('hides in whole batches, leaves the other settings, and keeps the set across atlases', async () => {
        const { engine, left, right, atlas, otherAtlas } = world();
        const { model } = engine;
        model.setCortexOpacity(0.7);
        const changes = collect(engine, 'change');
        const hidden = () => [...model.settings.hiddenRegions].sort();
        model.hideRegions([left.id, right.id]);
        assert.deepEqual(hidden(), [left.id, right.id].sort());
        const count = changes.length;
        model.hideRegions([left.id, right.id]);
        assert.equal(changes.length, count, 'the same batch again is not a change');
        model.showRegions([left.id]);
        assert.deepEqual(hidden(), [right.id]);
        model.undoDissection();
        assert.deepEqual(hidden(), [left.id, right.id].sort());
        model.undoDissection();
        assert.deepEqual(hidden(), []);
        assert.equal(model.settings.dissectionCanUndo, false);
        assert.equal(model.settings.cortexOpacity, 0.7, 'dissection leaves the other settings');
        assert.throws(() => model.hideRegions([left.id, 'missing']), /Unknown region/);
        assert.deepEqual(hidden(), [], 'a refused batch hides nothing');
        assert.equal(model.settings.dissectionCanUndo, false, 'and leaves nothing to undo');
        model.hideRegions([left.id]);
        await model.setAtlas(otherAtlas);
        await model.setAtlas(atlas);
        assert.deepEqual(hidden(), [left.id], 'the hidden set survives atlas switches');
      });

      it('releases the isolation when its region is hidden, and undo brings back what it can', () => {
        const { engine, left } = world();
        const { model } = engine;
        const changes = collect(engine, 'change');
        model.select(left.id);
        model.isolate();
        model.hideRegions([left.id]);
        assert.equal(model.settings.isolatedRegion, null, 'nothing would be left to see');
        model.undoDissection();
        assert.equal(model.settings.isolatedRegion, left.id);
        assert.equal(model.state.selectedRegion?.id, left.id);
        const selections = changes.map((change) => change.model.selectedRegion?.id ?? null);
        assert.deepEqual(
          selections.filter((id, at) => id !== selections[at - 1]),
          [left.id, null, left.id],
          'the restored selection is announced',
        );
        model.hideRegions([left.id]);
        model.setHemisphere('right');
        model.undoDissection();
        assert.equal(model.settings.hemisphere, 'right', 'undo does not change the hemisphere');
        assert.equal(model.settings.isolatedRegion, null);
        assert.equal(model.state.selectedRegion, null);
      });

      it('shows, restores and loads hidden regions', () => {
        const { engine, left, right } = world();
        const { model } = engine;
        model.hideRegions([left.id, right.id]);
        model.showRegions([left.id]);
        assert.deepEqual([...model.settings.hiddenRegions], [right.id]);
        model.restoreHiddenRegions();
        assert.equal(model.settings.hiddenRegions.size, 0);
        assert.equal(model.settings.dissectionCanUndo, true, 'a restore is one undoable step');
        model.undoDissection();
        assert.deepEqual([...model.settings.hiddenRegions], [right.id]);
        model.loadHiddenRegions([left.id]);
        assert.deepEqual([...model.settings.hiddenRegions], [left.id]);
        assert.equal(model.settings.dissectionCanUndo, false, 'a loaded link has no history');
      });

      it('releases an isolation a loaded hidden set hides, and keeps one it leaves alone', () => {
        const { engine, left, right } = world();
        const { model } = engine;
        model.select(left.id);
        model.isolate();
        model.loadHiddenRegions([left.id, right.id]);
        assert.equal(model.settings.isolatedRegion, null);
        assert.deepEqual([...model.settings.hiddenRegions].sort(), [left.id, right.id].sort());
        model.restoreHiddenRegions();
        model.select(right.id);
        model.isolate();
        model.loadHiddenRegions([left.id]);
        assert.equal(model.settings.isolatedRegion, right.id);
      });

      it('resets the display', () => {
        const { engine, left } = world();
        const { model } = engine;
        model.setHemisphere('right');
        model.setCortexOpacity(0.4);
        model.setInternalVisible(false);
        model.select(null);
        model.hideRegions([left.id]);
        model.reset();
        const { settings, state } = model;
        assert.equal(settings.hemisphere, 'both');
        assert.equal(settings.cortexOpacity, 1);
        assert.equal(settings.internalVisible, true);
        assert.equal(settings.hiddenRegions.size, 0);
        assert.equal(state.selectedRegion, null);
      });

      it('resets every setting but the atlas, the detail level and the paint', async () => {
        const { engine, left, cortex, otherAtlas } = world();
        const { model } = engine;
        const system = model.manifest.regions.find(
          (region) => region.kind === 'structure' && region.atlas === 'learning',
        )!.system_names!.en!;
        await model.setAtlas(otherAtlas);
        const painted = cortex('right', otherAtlas);
        model.setPaint({
          id: 'function:test',
          colors: new Map([[painted.id, [1, 2, 3] as const]]),
        });
        model.setHemisphere('left');
        model.setCortexOpacity(0.4);
        model.setInternalVisible(false);
        model.setInternalSystem(system);
        model.setSurfaceColor('tissue');
        model.select(cortex('left', otherAtlas).id);
        model.hideRegions([left.id]);
        // A show of the cord still on its way is cancelled.
        const showing = model.setSpinalCordVisible(true);
        model.reset();
        await showing;
        const { settings, state } = model;
        assert.equal(settings.atlas, otherAtlas);
        assert.equal(settings.detail, model.defaultDetail);
        assert.equal(settings.paint?.id, 'function:test', 'the paint belongs to the panel');
        assert.equal(settings.hemisphere, 'both');
        assert.equal(settings.cortexVisible, true);
        assert.equal(settings.cortexOpacity, 1);
        assert.equal(settings.internalVisible, true);
        assert.equal(settings.internalSystem, null);
        assert.equal(settings.internalConstituents.size, 0);
        assert.equal(settings.spinalCordVisible, false);
        assert.equal(settings.surfaceColor, 'atlas');
        assert.equal(settings.isolatedRegion, null);
        assert.equal(settings.hiddenRegions.size, 0);
        assert.equal(settings.dissectionCanUndo, false);
        assert.equal(state.selectedRegion, null);
      });

      it('switches atlas, refusing an unpublished one with an unknown-layer code', async () => {
        const { engine, left, otherAtlas } = world();
        const { model } = engine;
        await assert.rejects(model.setAtlas('no-such-atlas'), rejectsWith('unknown-layer'));
        model.select(left.id);
        await model.setAtlas(otherAtlas);
        assert.equal(model.settings.atlas, otherAtlas);
        assert.ok(model.hasLayer(otherAtlas));
        assert.equal(model.state.selectedRegion, null);
      });

      it('drops the selection and the isolation when the atlas changes', async () => {
        const { engine, left, otherAtlas } = world();
        const { model } = engine;
        const changes = collect(engine, 'change');
        model.select(left.id);
        model.isolate();
        assert.equal(model.settings.isolatedRegion, left.id);
        await model.setAtlas(otherAtlas);
        assert.equal(model.state.selectedRegion, null);
        assert.equal(model.settings.isolatedRegion, null);
        assert.equal(changes.at(-1)?.model.selectedRegion, null);
      });

      it('switches detail level, refusing an unpublished one', async () => {
        const { model } = world().engine;
        await assert.rejects(model.setDetail('no-such-level'), rejectsWith('unknown-layer'));
        const other = model.manifest.detail_levels.find(
          (level) => level.id !== model.settings.detail,
        )!;
        await model.setDetail(other.id);
        assert.equal(model.settings.detail, other.id);
        assert.equal(model.settings.internalSystem, null);
      });

      it('drops the internal system, the isolation and the selection when the detail level changes', async () => {
        const { model } = world().engine;
        const caudate = model.regions.get('learning:left:caudate')!;
        model.setInternalSystem(caudate.system_names!.en!);
        model.select(caudate.id);
        model.isolate();
        assert.equal(model.settings.isolatedRegion, caudate.id);
        const other = model.manifest.detail_levels.find(
          (level) => level.id !== model.settings.detail,
        )!;
        await model.setDetail(other.id);
        assert.equal(model.settings.internalSystem, null);
        assert.equal(model.settings.internalConstituents.size, 0);
        assert.equal(model.settings.isolatedRegion, null);
        assert.equal(model.state.selectedRegion, null);
      });

      it('selects an internal system of the learning level', () => {
        const { model } = world().engine;
        const system = model.manifest.regions.find(
          (region) => region.kind === 'structure' && region.atlas === 'learning',
        )!.system_names!.en!;
        model.setInternalSystem(system);
        assert.equal(model.settings.internalSystem, system);
        model.setInternalSystem(null);
        assert.equal(model.settings.internalSystem, null);
      });

      it('narrows the internal anatomy to one system, dropping what it no longer shows', () => {
        const { engine, regions } = world();
        const { model } = engine;
        model.setCortexVisible(false);
        model.setInternalSystem('Basal ganglia');
        assert.equal(model.state.visibleMeshCount, 14);
        const drawn = [...regions.values()].filter((region) => model.isRegionDrawn(region.id));
        assert.ok(drawn.every((region) => region.system_names?.en === 'Basal ganglia'));
        const caudate = regions.get('learning:left:caudate')!;
        model.select(caudate.id);
        model.isolate();
        model.setInternalSystem('Brainstem');
        assert.equal(model.state.selectedRegion, null);
        assert.equal(model.settings.isolatedRegion, null);
        model.reset();
        assert.equal(model.settings.internalSystem, null);
      });

      it('colours the surface at once, leaving the cut alone', () => {
        const { engine, atlas } = world();
        const { model, sections } = engine;
        const changes = collect(engine, 'change');
        const cut = sections.state;
        model.setSurfaceColor('tissue');
        assert.equal(model.settings.surfaceColor, 'tissue');
        assert.equal(changes.at(-1)?.model.surfaceColor, 'tissue');
        assert.deepEqual(sections.state, cut);
        model.setSurfaceColor('atlas');
        assert.equal(model.settings.surfaceColor, 'atlas');
        assert.throws(() => model.setSurfaceColor('plaid' as never), TypeError);
        assert.throws(() => model.setSurfaceColor('mri'), /MRI must load/);
        assert.equal(model.settings.atlas, atlas);
        assert.equal(model.settings.surfaceColor, 'atlas', 'a refused colour is not applied');
      });
    });

    describe('sections', () => {
      const world = sharedEngine(create);

      it('cuts, reporting the plane to the model', async () => {
        await cutsReportingThePlane(world());
      });

      it('hands out snapshots, not its live state', () => {
        const { engine } = world();
        const changes = collect(engine, 'change');
        engine.sections.setDisplay({ reverse: true });
        engine.sections.setDisplay({ reverse: false });
        // A command may report more than once (the cut and the model each emit); the last report of each
        // is what a listener ends up holding.
        const snapshots = changes.map((change) => change.sections);
        const first = snapshots.findLast((snapshot) => snapshot.reverse);
        const second = snapshots.at(-1);
        assert.notEqual(first, second);
        assert.equal(first!.reverse, true);
        assert.equal(second!.reverse, false);
        assert.notEqual(engine.sections.state, engine.sections.state);
      });

      it('chooses the latest of the modes it is asked for, and words an unknown one', async () => {
        const { engine } = world();
        const { sections, model } = engine;
        const first = sections.setMode('coronal');
        const second = sections.setMode('off');
        await Promise.all([first, second]);
        assert.equal(sections.state.mode, 'off');
        assert.equal(model.settings.cutActive, false);
        await assert.rejects(
          sections.setMode('diagonal' as never),
          exactly('Unknown cut mode: diagonal'),
        );
      });

      it('frames the standard planes with fixed axes and edge letters', async () => {
        const { sections } = world().engine;
        const planes = [
          ['sagittal', [1, 0, 0], [0, -1, 0], [0, 0, 1], ['S', 'P', 'I', 'A']],
          ['coronal', [0, 1, 0], [1, 0, 0], [0, 0, 1], ['S', 'R', 'I', 'L']],
          ['axial', [0, 0, 1], [1, 0, 0], [0, 1, 0], ['A', 'R', 'P', 'L']],
        ] as const;
        for (const [mode, normal, u, v, edges] of planes) {
          await sections.setMode(mode);
          const { frame } = sections;
          near(frame.normal, normal);
          near(frame.u, u);
          near(frame.v, v);
          assert.deepEqual([...frame.edges], edges, mode);
        }
        sections.setAngles(30, 30);
        await sections.setMode('oblique');
        near(sections.frame.normal, [0.4330127, 0.25, 0.8660254], 1e-7);
        assert.deepEqual([...sections.frame.edges], [], 'an oblique cut has no edge letters');
      });

      it('keeps the crosshair and the offset inside the volume', async () => {
        const { sections } = world().engine;
        assert.throws(() => sections.setCrosshair([1e6, 0, 0]), RangeError);
        assert.throws(() => sections.setCrosshair([Number.NaN, 0, 0]), RangeError);
        await sections.setMode('sagittal');
        const [minimum, maximum] = sections.offsetRange;
        assert.ok(minimum <= -128 && maximum >= 128);
        sections.setOffset(10);
        assert.ok(Math.abs(sections.offset - 10) < 1e-9);
        assert.deepEqual(sections.frame.normal, [1, 0, 0]);
        assert.throws(() => sections.setOffset(maximum + 1), RangeError);
        await sections.setOffsetReady(-20);
        assert.ok(Math.abs(sections.offset + 20) < 1e-9);
      });

      it('ranges the offset over the volume, wider along an oblique normal', async () => {
        const { sections } = world().engine;
        for (const mode of ['sagittal', 'coronal', 'axial'] as const) {
          await sections.setMode(mode);
          assert.deepEqual([...sections.offsetRange], [-128, 128], mode);
        }
        sections.setAngles(30, 30);
        await sections.setMode('oblique');
        assert.deepEqual(
          sections.offsetRange.map((value) => Math.round(value * 10) / 10),
          [-147.8, 147.8],
        );
        const [, maximum] = sections.offsetRange;
        sections.setOffset(maximum);
        assert.throws(() => sections.setOffset(maximum + 0.01), RangeError);
      });

      it('moves the crosshair along the normal of the cut and no other way', async () => {
        const { sections } = world().engine;
        sections.setCrosshair([5, -20, 30]);
        await sections.setMode('axial');
        sections.setOffset(60);
        assert.deepEqual(sections.state.crosshair, [5, -20, 60]);
        await sections.setMode('sagittal');
        sections.setOffset(0);
        assert.deepEqual(sections.state.crosshair, [0, -20, 60]);
        // An oblique offset puts the crosshair at the foot of the plane on its normal.
        sections.setCrosshair([100, 0, -100]);
        sections.setAngles(45, 0);
        await sections.setMode('oblique');
        sections.setOffset(60);
        const { crosshair } = sections.state;
        near([dot(crosshair, sections.frame.normal)], [60]);
        assert.ok(crosshair.every((value) => Math.abs(value) <= 128));
      });

      it('validates the oblique angles and the display options', async () => {
        const { sections } = world().engine;
        assert.throws(() => sections.setAngles(120, 0), RangeError);
        sections.setAngles(40, -20);
        assert.deepEqual([sections.state.tilt, sections.state.azimuth], [40, -20]);
        await sections.setAnglesReady(10, 5);
        assert.deepEqual([sections.state.tilt, sections.state.azimuth], [10, 5]);
        assert.throws(() => sections.setDisplay({ reverse: 1 as never }), TypeError);
        sections.setDisplay({ reverse: true, overlay: true });
        assert.deepEqual([sections.state.reverse, sections.state.overlay], [true, true]);
        sections.setDisplay({ overlay: false });
        assert.equal(sections.state.reverse, true, 'an omitted option keeps its value');
      });

      it('accepts a tilt of 0 to 90 and an azimuth of -180 to 180 only, and cuts along their normal', async () => {
        const { sections } = world().engine;
        for (const [tilt, azimuth] of [
          [-1, 0],
          [91, 0],
          [120, 0],
          [0, 181],
          [0, -181],
          [0, 200],
        ] as const) {
          refuses(
            () => sections.setAngles(tilt, azimuth),
            RangeError,
            'Oblique angles are out of range.',
          );
        }
        assert.deepEqual([sections.state.tilt, sections.state.azimuth], [30, 30]);
        for (const [tilt, azimuth] of [
          [0, -180],
          [90, 180],
        ] as const) {
          sections.setAngles(tilt, azimuth);
          assert.deepEqual([sections.state.tilt, sections.state.azimuth], [tilt, azimuth]);
        }
        sections.setCrosshair([10, -20, 30]);
        sections.setAngles(38, 71);
        await sections.setMode('oblique');
        const { normal, u, v, center } = sections.frame;
        const [t, a] = [(38 * Math.PI) / 180, (71 * Math.PI) / 180];
        near(normal, [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)]);
        for (const axis of [normal, u, v]) near([dot(axis, axis)], [1]);
        near([dot(normal, u), dot(normal, v), dot(u, v)], [0, 0, 0]);
        near([dot(normal, center) - dot(normal, [10, -20, 30])], [0]);
      });

      it('refuses a display option that is not a boolean, and changes nothing', () => {
        const { sections } = world().engine;
        refuses(
          () => sections.setDisplay({ reverse: 1 as never }),
          TypeError,
          'Section display options must be boolean.',
        );
        refuses(
          () => sections.setDisplay({ overlay: 'yes' as never }),
          TypeError,
          'Section display options must be boolean.',
        );
        assert.deepEqual([sections.state.reverse, sections.state.overlay], [false, false]);
        sections.setDisplay({ reverse: true, overlay: true });
        sections.setDisplay({ overlay: false });
        assert.deepEqual([sections.state.reverse, sections.state.overlay], [true, false]);
      });

      it('chooses the label volume of the cut', async () => {
        const { engine, otherAtlas } = world();
        const { sections } = engine;
        await sections.setMode('axial');
        await sections.setCutAtlas(otherAtlas);
        assert.equal(sections.state.cutAtlas, otherAtlas);
        assert.equal(engine.model.settings.cutAtlas, otherAtlas);
        const before = sections.state.cutAtlas;
        await assert.rejects(sections.setCutAtlas('no-such-atlas'));
        assert.equal(sections.state.cutAtlas, before, 'a failed choice leaves the previous one');
      });

      it('selects a region only the cut shows, while the cut is open on its atlas', async () => {
        const { engine } = world();
        const { model, sections } = engine;
        const cutOnly = model.manifest.regions.find(
          (region) =>
            region.kind === 'tissue-region' &&
            region.atlas === 'nextbrain' &&
            region.hemisphere === 'left',
        )!;
        assert.throws(() => model.select(cutOnly.id), /not visible/);
        await sections.setMode('axial');
        await sections.setCutAtlas('nextbrain');
        model.select(cutOnly.id);
        assert.equal(model.state.selectedRegion?.id, cutOnly.id);
        model.setCortexOpacity(0.5);
        assert.equal(
          model.state.selectedRegion?.id,
          cutOnly.id,
          'it stays selected across redraws',
        );
        model.setHemisphere('right');
        assert.equal(model.state.selectedRegion, null, 'it obeys the hemisphere filter');
        assert.throws(() => model.select(cutOnly.id), /not visible/);
        model.setHemisphere('both');
        model.select(cutOnly.id);
        await sections.setMode('off');
        assert.equal(model.state.selectedRegion, null, 'closing the cut drops it');
        assert.throws(() => model.select(cutOnly.id), /not visible/);
      });

      it('refuses a colour whose atlas is not on screen', async () => {
        const { engine } = world();
        const { cabNp } = engine.model;
        assert.ok(cabNp, 'the contract needs an anatomy with CAB-NP');
        await assert.rejects(engine.sections.setSurfaceColor('cab-np'), /show that atlas first/);
        await engine.model.setAtlas(cabNp.atlas);
        await engine.sections.setSurfaceColor('cab-np');
        assert.equal(engine.model.settings.surfaceColor, 'cab-np');
        await engine.model.setAtlas(
          engine.model.manifest.atlases.find((a) => a.id !== cabNp.atlas)!.id,
        );
        assert.equal(
          engine.model.settings.surfaceColor,
          'atlas',
          'a colour the new atlas cannot carry is dropped',
        );
      });
    });

    // These cases need the MRI unloaded as they open; the "first use" group's linked-MRI case loads it.
    describe('before the MRI loads', () => {
      it('colours the surface, downloading what the colour needs', async () => {
        const { engine } = await fresh();
        const { sections, model } = engine;
        assert.throws(() => model.setSurfaceColor('mri'), /MRI must load/);
        await sections.setSurfaceColor('mri');
        assert.equal(model.settings.surfaceColor, 'mri');
        assert.equal(sections.volumesLoaded, false, 'the colour loads the T1, not the linked MRI');
        assert.equal(sections.display, null);
        await sections.setSurfaceColor('atlas');
        assert.equal(model.settings.surfaceColor, 'atlas');
        await sections.setSurfaceColor('mri', () => false);
        assert.equal(
          model.settings.surfaceColor,
          'atlas',
          'an overtaken download lands without a colour change',
        );
      });

      it('resamples the planes and samples the volume only once loaded', async () => {
        const { engine } = await fresh();
        const { sections } = engine;
        assert.throws(() => sections.pixels(sections.mprFrame('axial')));
        assert.throws(() => sections.sample([0, 0, 0]));
        await sections.load();
        const { size } = sections.display!;
        for (const plane of ['sagittal', 'coronal', 'axial'] as const) {
          assert.equal(sections.pixels(sections.mprFrame(plane)).length, size * size * 4);
        }
        assert.deepEqual(sections.mprFrame('axial').normal, [0, 0, 1]);
        assert.deepEqual(sections.mprFrame('coronal').normal, [0, 1, 0]);
        const sample = sections.sample([10, 20, 30]);
        assert.deepEqual(sample.ras, [10, 20, 30]);
        assert.equal(typeof sample.labelId, 'number');
        assert.equal(typeof sample.name, 'string');
      });
    });

    describe('camera', () => {
      const world = sharedEngine(create);

      it('holds a named view, and tells when it is let go', () => {
        const { camera } = world().engine;
        const { engine } = world();
        // The page opens on the held oblique view, which a link does not carry.
        assert.equal(camera.viewHeld, true);
        assert.equal(camera.orbitLink(), null);
        const held = collect(engine, 'viewHeld');
        camera.orbitBy({ azimuth: 0.1 });
        assert.equal(camera.viewHeld, false);
        assert.deepEqual(held, [{ held: false }]);
        held.length = 0;
        camera.applyView('left', { immediate: true });
        assert.equal(camera.viewHeld, true);
        camera.frameCurrent('right');
        assert.deepEqual(held, [{ held: true }], 'a held view re-held is not a new event');
        camera.orbitBy({ azimuth: 0.1 });
        assert.equal(camera.viewHeld, false);
        assert.deepEqual(held.at(-1), { held: false });
        camera.applyView('oblique');
        camera.dolly(1.1);
        assert.equal(camera.viewHeld, false);
      });

      it('reports the camera per move, outside the change event', async () => {
        const { engine } = world();
        const moves = collect(engine, 'camera');
        const settled = collect(engine, 'cameraSettled');
        const changes = collect(engine, 'change');
        engine.camera.applyView('superior', { immediate: true });
        assert.ok(moves.length > 0 && settled.length > 0);
        assert.equal(changes.length, 0);
        const [view] = moves.slice(-1);
        assert.ok(view);
        assert.deepEqual(Object.keys(view.edges).sort(), ['bottom', 'left', 'right', 'top']);
        assert.deepEqual(engine.camera.view, view);
        // An eased move: the link follows the destination at once; the real stage reports the camera frame
        // by frame after the call, where the fake reports it in the call.
        const reported = moves.length;
        const placed = settled.length;
        engine.camera.applyView('inferior');
        assert.ok(settled.length > placed);
        await vi.waitFor(
          () => {
            fixtures.drawFrame?.();
            assert.ok(moves.length > reported);
          },
          { timeout: 5_000 },
        );
      });

      it('releases the view when it frames something other than a preset', () => {
        const { engine, left, otherAtlas, cortex } = world();
        const { camera } = engine;
        camera.applyView('left');
        assert.equal(camera.frameRegion(left.id), true);
        assert.equal(camera.viewHeld, false);
        camera.applyView('left');
        camera.frameRegions([left.id]);
        assert.equal(camera.viewHeld, false);
        camera.applyView('left');
        assert.equal(camera.frameLandmark(left.id, 'anterior', 20), true);
        assert.equal(camera.viewHeld, false);
        assert.equal(camera.frameRegion(cortex('left', otherAtlas).id), false, 'no drawn mesh');
        assert.equal(camera.frameLandmark(cortex('left', otherAtlas).id, 'left', 20), false);
        camera.applyView('left');
        camera.focusPoint([10, 0, 0]);
        assert.equal(camera.viewHeld, false);
      });

      it('does nothing, and keeps the held view, when none of the regions is drawn', () => {
        const { engine } = world();
        const moves = collect(engine, 'camera');
        engine.camera.applyView('left');
        const count = moves.length;
        engine.camera.frameRegions(['no-such-region']);
        assert.equal(engine.camera.viewHeld, true);
        assert.equal(moves.length, count);
      });

      it('leaves the held view alone when it frames the whole or the internal anatomy', () => {
        const { engine } = world();
        engine.camera.applyView('left');
        engine.camera.frameWhole();
        engine.camera.frameInternal();
        assert.equal(engine.camera.viewHeld, true);
      });

      it('faces the cut it is cutting', async () => {
        const { engine } = world();
        const { camera, sections } = engine;
        assert.equal(camera.faceCut(), null);
        await sections.setMode('coronal');
        assert.equal(camera.faceCut(), 'anterior');
        assert.equal(camera.viewHeld, true);
        sections.setDisplay({ reverse: true });
        assert.equal(camera.faceCut(), 'posterior');
        await sections.setMode('oblique');
        assert.equal(camera.faceCut(), 'oblique');
        assert.equal(camera.viewHeld, false, 'an oblique cut is faced along its own normal');
      });

      it('captures and restores a camera, and whether its view was held', () => {
        const { camera } = world().engine;
        camera.applyView('left', { immediate: true });
        const snapshot = camera.capture();
        camera.orbitBy({ polar: 0.2 });
        assert.equal(camera.viewHeld, false);
        camera.restore('left', snapshot, { immediate: true });
        assert.equal(camera.viewHeld, true);
      });

      it('places a link camera and reads it back; a held view has no orbit link', () => {
        const { camera } = world().engine;
        camera.applyView('left', { immediate: true });
        assert.equal(camera.orbitLink(), null);
        const start = camera.capture();
        camera.restore('left', start, { immediate: true });
        camera.orbitBy({ azimuth: 0.2 });
        const orbit = camera.orbitLink();
        assert.ok(orbit);
        camera.applyView('right', { immediate: true });
        camera.placeOrbit(orbit, { immediate: true });
        assert.equal(camera.viewHeld, false);
        const placed = camera.orbitLink()!;
        placed.position.forEach((value, axis) =>
          assert.ok(Math.abs(value - orbit.position[axis]!) < 1e-3),
        );
        placed.target.forEach((value, axis) =>
          assert.ok(Math.abs(value - orbit.target[axis]!) < 1e-3),
        );
        assert.throws(
          () => camera.placeOrbit({ position: [1e7, 0, 0], target: [0, 0, 0] }),
          RangeError,
        );
      });

      it('measures a pull-based framing source when it frames', () => {
        const { camera } = world().engine;
        let asked = 0;
        camera.setFramingSource(() => {
          asked++;
          return { inset: { bottom: 120 }, scale: { horizontal: 1, vertical: 1 } };
        });
        camera.applyView('left');
        assert.ok(asked > 0);
      });

      it('shrinks the visible rectangle for the sheet, and says so', () => {
        const { engine } = world();
        const { camera } = engine;
        const viewports = collect(engine, 'viewport');
        const before = camera.visibleRect;
        assert.ok(camera.hostSize.height > 200, 'the contract needs a stage with room');
        camera.setChromeInsets({ bottom: 200 }, { settle: false });
        assert.ok(camera.visibleRect.height < before.height);
        assert.equal(viewports.at(-1)?.hostSize.height, camera.hostSize.height);
      });

      it('keeps its fit when the dock changes', () => {
        const { camera } = world().engine;
        camera.applyView('left', { immediate: true });
        const fit = camera.fittedDistance();
        assert.ok(fit > 0);
        camera.keepFraming(fit);
        camera.refitDock();
        camera.recenter();
        assert.equal(camera.viewHeld, true);
      });
    });

    describe('presentation', () => {
      const world = sharedEngine(create);

      it('accepts the look of the app state, and a theme change', () => {
        const { engine } = world();
        engine.present({ lang: 'fr', referenceOnly: false });
        engine.present({ lang: 'en', referenceOnly: false });
        engine.applyTheme('dark');
        engine.invalidate();
      });
    });

    describe('comparison', () => {
      const world = sharedEngine(create);

      it('outlines an overlap and clears it, and a later request overtakes an earlier one', async (test) => {
        if (!fixtures.comparison) return test.skip();
        const { engine } = world();
        const { id, geometry } = fixtures.comparison;
        assert.equal(await engine.comparison.highlight(id, geometry), true);
        const first = engine.comparison.highlight(id, geometry);
        const second = engine.comparison.highlight(id, geometry);
        assert.deepEqual(await Promise.all([first, second]), [false, true]);
        engine.comparison.setVisible(false);
        engine.comparison.clear();
      });
    });

    describe('tracts', () => {
      const world = sharedEngine(create);

      it('thins the streamlines by their minimum length', async () => {
        const { tracts } = world().engine;
        await tracts.setActive(true);
        tracts.setMinimum(1e6);
        for (const bundle of tracts.snapshot()) assert.equal(bundle.shown, 0);
        tracts.setMinimum(1);
        for (const bundle of tracts.snapshot()) {
          assert.equal(bundle.shown, bundle.total);
          assert.ok(bundle.mean !== null && bundle.min !== null && bundle.max !== null);
        }
        assert.throws(() => tracts.setOutlineOpacity(2), RangeError);
        tracts.setOutlineOpacity(0.5);
        tracts.setOverlay(true);
      });

      it('converts a point between the scan and the surface, both ways', () => {
        const { engine } = world();
        const scanner: Vec3 = [10, -20, 30];
        const surface = engine.tracts.scannerToSurface(scanner);
        assert.equal(surface.length, 3);
        const back = engine.tracts.surfaceToScanner(surface);
        back.forEach((value, axis) => assert.ok(Math.abs(value - scanner[axis]!) < 1e-6));
      });

      it('opens the MRI navigator on a canvas', async (test) => {
        if (!fixtures.canvas) return test.skip();
        await opensTheMriNavigator(world(), fixtures.canvas);
      });
    });

    describe('lifecycle', () => {
      it('is disposed once, and the model says so', async () => {
        const { engine } = await fresh();
        assert.equal(engine.model.disposed, false);
        engine.dispose();
        assert.equal(engine.model.disposed, true);
      });
    });
  });
}

/**
 * What only a real stage on real WebGL shows: that the engine opens, that a cut runs on the cut worker, and
 * that the MRI navigator draws on its canvas. The cases run in order on one engine.
 */
export function defineStageContract(
  name: string,
  create: () => Promise<Engine> | Engine,
  fixtures: { canvas: HTMLCanvasElement },
) {
  describe(`stage contract: ${name}`, () => {
    const world = sharedEngine(create);

    it('opens on the first atlas and the default detail level', () => {
      opensOnTheFirstAtlas(world());
    });

    it('cuts, reporting the plane to the model', async () => {
      await cutsReportingThePlane(world());
    });

    it('opens the MRI navigator on a canvas', async () => {
      await opensTheMriNavigator(world(), fixtures.canvas);
    });
  });
}
