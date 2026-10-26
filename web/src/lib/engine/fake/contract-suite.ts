import { assert } from './assert.ts';
import { describe, it, onTestFinished, vi } from 'vitest';
import type { Region } from '../../types/index.ts';
import { HIGH_FREQUENCY_EVENTS } from '../api.ts';
import type { Engine, EngineEvents, MriLocation, Vec3 } from '../api.ts';

export interface ContractFixtures {
  /** The canvas `tracts.createMriNavigator` draws on; the fake ignores it. */
  canvas: HTMLCanvasElement;
  /** An overlap the atlas comparison can outline, with its geometry file; omit to skip those cases. */
  comparison?: { id: string; geometry: { file: string; sha256: string } };
}

const codeOf = (error: unknown) => (error as { code?: string }).code;
const rejectsWith = (code: string) => (error: unknown) => codeOf(error) === code;

/** Collect an event's payloads until the test ends. */
function collect<K extends keyof EngineEvents>(engine: Engine, type: K) {
  const events: EngineEvents[K][] = [];
  onTestFinished(engine.on(type, (event) => events.push(event)));
  return events;
}

/**
 * The behaviour every implementation of `Engine` must show: the in-memory fake (`contract.test.ts`) and
 * E7's real engine (which calls this from its own test file with a factory that boots it). It reads
 * everything it needs from the engine's own manifest, so it holds for any published anatomy that has two
 * cortical atlases, the learning detail level, CAB-NP and the functional divisions. `captureSnapshot` needs
 * a canvas and a frame, so each implementation tests it where it can draw.
 */
export function defineEngineContract(
  name: string,
  create: () => Promise<Engine> | Engine,
  fixtures: ContractFixtures,
) {
  async function boot() {
    const engine = await create();
    onTestFinished(() => engine.dispose());
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

  describe(`engine contract: ${name}`, () => {
    describe('events', () => {
      it('unsubscribes', async () => {
        const { engine, left } = await boot();
        const seen: unknown[] = [];
        const off = engine.on('change', (event) => seen.push(event));
        engine.model.select(left.id);
        const count = seen.length;
        assert.ok(count > 0);
        off();
        engine.model.select(null);
        assert.equal(seen.length, count);
      });

      it('names the per-frame events', () => {
        assert.deepEqual([...HIGH_FREQUENCY_EVENTS], ['camera', 'hover', 'viewport']);
      });
    });

    describe('model', () => {
      it('opens on the first atlas and the default detail level', async () => {
        const { engine, atlas } = await boot();
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
      });

      it('selects a visible region, reports it in a change, and clears it', async () => {
        const { engine, left } = await boot();
        const changes = collect(engine, 'change');
        engine.model.select(left.id);
        assert.equal(engine.model.state.selectedRegion?.id, left.id);
        assert.equal(changes.at(-1)?.model.selectedRegion?.id, left.id);
        engine.model.select(null);
        assert.equal(engine.model.state.selectedRegion, null);
      });

      it('refuses an unknown, non-region or hidden selection', async () => {
        const { engine, cortex, otherAtlas } = await boot();
        const { manifest } = engine.model;
        const otherCortex = cortex('left', otherAtlas);
        assert.throws(() => engine.model.select('no-such-region'), /Unknown region/);
        const nonRegion = manifest.regions.find((region) => region.kind === 'non-region')!;
        assert.throws(() => engine.model.select(nonRegion.id), /non-region/);
        assert.throws(() => engine.model.select(otherCortex.id), /not visible/);
      });

      it('drops a selection the settings no longer show', async () => {
        const { engine, right } = await boot();
        engine.model.select(right.id);
        engine.model.setHemisphere('left');
        assert.equal(engine.model.state.selectedRegion, null);
      });

      it('validates its setters', async () => {
        const { engine } = await boot();
        const { model } = engine;
        assert.throws(() => model.setHemisphere('up' as never));
        assert.throws(() => model.setCortexOpacity(1.5), RangeError);
        assert.throws(() => model.setCortexOpacity(Number.NaN), RangeError);
        assert.throws(() => model.setCortexVisible('yes' as never), TypeError);
        assert.throws(() => model.setInternalVisible(1 as never), TypeError);
        assert.throws(() => model.setFunctionalLevel('deep' as never), TypeError);
        assert.throws(
          () => model.setInternalSystem('No such system'),
          /Unknown internal anatomy system/,
        );
        assert.throws(() => model.setPaint({ id: 'x', colors: {} } as never), TypeError);
      });

      it('refuses to select a cortical region once the cortex is transparent', async () => {
        const { engine, left } = await boot();
        engine.model.setCortexOpacity(0);
        assert.throws(() => engine.model.select(left.id), /not visible/);
      });

      it('isolates the selection and releases it on a setting change', async () => {
        const { engine, left } = await boot();
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

      it('paints by id, and the same id is not a change', async () => {
        const { engine, left } = await boot();
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

      it('dissects with one history entry per action, and undoes them', async () => {
        const { engine, left, right } = await boot();
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

      it('shows, restores and loads hidden regions', async () => {
        const { engine, left, right } = await boot();
        const { model } = engine;
        model.hideRegions([left.id, right.id]);
        model.showRegions([left.id]);
        assert.deepEqual([...model.settings.hiddenRegions], [right.id]);
        model.restoreHiddenRegions();
        assert.equal(model.settings.hiddenRegions.size, 0);
        model.loadHiddenRegions([left.id]);
        assert.deepEqual([...model.settings.hiddenRegions], [left.id]);
        assert.equal(model.settings.dissectionCanUndo, false, 'a loaded link has no history');
      });

      it('resets the display', async () => {
        const { engine, left } = await boot();
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

      it('switches atlas, refusing an unpublished one with an unknown-layer code', async () => {
        const { engine, left, otherAtlas } = await boot();
        const { model } = engine;
        await assert.rejects(model.setAtlas('no-such-atlas'), rejectsWith('unknown-layer'));
        model.select(left.id);
        await model.setAtlas(otherAtlas);
        assert.equal(model.settings.atlas, otherAtlas);
        assert.ok(model.hasLayer(otherAtlas));
        assert.equal(model.state.selectedRegion, null);
      });

      it('switches detail level, refusing an unpublished one', async () => {
        const { engine } = await boot();
        const { model } = engine;
        await assert.rejects(model.setDetail('no-such-level'), rejectsWith('unknown-layer'));
        const other = model.manifest.detail_levels.find(
          (level) => level.id !== model.settings.detail,
        )!;
        await model.setDetail(other.id);
        assert.equal(model.settings.detail, other.id);
        assert.equal(model.settings.internalSystem, null);
      });

      it('selects an internal system of the learning level', async () => {
        const { engine } = await boot();
        const { model } = engine;
        const system = model.manifest.regions.find(
          (region) => region.kind === 'structure' && region.atlas === 'learning',
        )!.system_names!.en!;
        model.setInternalSystem(system);
        assert.equal(model.settings.internalSystem, system);
        model.setInternalSystem(null);
        assert.equal(model.settings.internalSystem, null);
      });

      it('colours the surface at once, leaving the cut alone', async () => {
        const { engine, atlas } = await boot();
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

      it('downloads the spinal cord on first showing', async () => {
        const { engine } = await boot();
        const { model } = engine;
        assert.notEqual(model.spinalCordLoad, 'ready');
        await assert.rejects(model.setSpinalCordVisible('yes' as never), TypeError);
        await model.setSpinalCordVisible(true);
        assert.equal(model.spinalCordLoad, 'ready');
        assert.equal(model.settings.spinalCordVisible, true);
        await model.setSpinalCordVisible(false);
        assert.equal(model.settings.spinalCordVisible, false);
      });

      it('downloads the envelopes on request', async () => {
        const { engine } = await boot();
        await engine.model.ensureEnvelopes();
        assert.equal(engine.model.envelopesLoaded, true);
      });

      it('prefetches a layer without changing the display', async () => {
        const { engine, otherAtlas, atlas } = await boot();
        await engine.model.prefetchLayer(otherAtlas);
        assert.ok(engine.model.hasLayer(otherAtlas));
        assert.equal(engine.model.settings.atlas, atlas);
      });

      it('refuses to prefetch what is not an atlas or a detail level', async () => {
        const { engine } = await boot();
        // A supplemental layer loads with its own command (the E4b review).
        await assert.rejects(engine.model.prefetchLayer('zanatomy'), rejectsWith('unknown-layer'));
        await assert.rejects(
          engine.model.prefetchLayer('no-such-layer'),
          rejectsWith('unknown-layer'),
        );
        assert.equal(engine.model.hasLayer('zanatomy'), false);
      });

      it('reports centroids in RAS millimetres only for geometry it has', async () => {
        const { engine, left, cortex, otherAtlas } = await boot();
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
    });

    describe('sections', () => {
      it('cuts, reporting the plane to the model', async () => {
        const { engine } = await boot();
        const { sections, model } = engine;
        const changes = collect(engine, 'change');
        assert.equal(sections.active, false);
        await assert.rejects(sections.setMode('diagonal' as never), /Unknown cut mode/);
        await sections.setMode('coronal');
        assert.equal(sections.state.mode, 'coronal');
        assert.equal(sections.active, true);
        assert.equal(model.settings.cutActive, true);
        assert.equal(model.settings.cutAtlas, sections.state.cutAtlas);
        assert.equal(changes.at(-1)?.sections.mode, 'coronal');
        await sections.setMode('off');
        assert.equal(model.settings.cutActive, false);
      });

      it('hands out snapshots, not its live state', async () => {
        const { engine } = await boot();
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

      it('keeps the crosshair and the offset inside the volume', async () => {
        const { engine } = await boot();
        const { sections } = engine;
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

      it('validates the oblique angles and the display options', async () => {
        const { engine } = await boot();
        const { sections } = engine;
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

      it('chooses the label volume of the cut', async () => {
        const { engine, otherAtlas } = await boot();
        const { sections } = engine;
        await sections.setMode('axial');
        await sections.setCutAtlas(otherAtlas);
        assert.equal(sections.state.cutAtlas, otherAtlas);
        assert.equal(engine.model.settings.cutAtlas, otherAtlas);
        const before = sections.state.cutAtlas;
        await assert.rejects(sections.setCutAtlas('no-such-atlas'));
        assert.equal(sections.state.cutAtlas, before, 'a failed choice leaves the previous one');
      });

      it('serves the linked MRI once loaded', async () => {
        const { engine } = await boot();
        const { sections } = engine;
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

      it('resamples the planes and samples the volume only once loaded', async () => {
        const { engine } = await boot();
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

      it('colours the surface, downloading what the colour needs', async () => {
        const { engine } = await boot();
        const { sections, model } = engine;
        await sections.setSurfaceColor('mri');
        assert.equal(model.settings.surfaceColor, 'mri');
        await sections.setSurfaceColor('atlas');
        assert.equal(model.settings.surfaceColor, 'atlas');
        await sections.setSurfaceColor('functional', () => false);
        assert.equal(
          model.settings.surfaceColor,
          'atlas',
          'an overtaken download lands without a colour change',
        );
      });

      it('refuses a colour whose atlas is not on screen', async () => {
        const { engine } = await boot();
        const { cabNp, functionalRegions } = engine.model;
        assert.ok(
          cabNp && functionalRegions,
          'the contract needs an anatomy with CAB-NP and functional divisions',
        );
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

    describe('camera', () => {
      it('holds a named view, and tells when it is let go', async () => {
        const { engine } = await boot();
        const { camera } = engine;
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
        const { engine } = await boot();
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
        await vi.waitFor(() => assert.ok(moves.length > reported), { timeout: 5_000 });
      });

      it('releases the view when it frames something other than a preset', async () => {
        const { engine, left, otherAtlas, cortex } = await boot();
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

      it('does nothing, and keeps the held view, when none of the regions is drawn', async () => {
        const { engine } = await boot();
        const moves = collect(engine, 'camera');
        engine.camera.applyView('left');
        const count = moves.length;
        engine.camera.frameRegions(['no-such-region']);
        assert.equal(engine.camera.viewHeld, true);
        assert.equal(moves.length, count);
      });

      it('leaves the held view alone when it frames the whole or the internal anatomy', async () => {
        const { engine } = await boot();
        engine.camera.applyView('left');
        engine.camera.frameWhole();
        engine.camera.frameInternal();
        assert.equal(engine.camera.viewHeld, true);
      });

      it('faces the cut it is cutting', async () => {
        const { engine } = await boot();
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

      it('captures and restores a camera, and whether its view was held', async () => {
        const { engine } = await boot();
        const { camera } = engine;
        camera.applyView('left', { immediate: true });
        const snapshot = camera.capture();
        camera.orbitBy({ polar: 0.2 });
        assert.equal(camera.viewHeld, false);
        camera.restore('left', snapshot, { immediate: true });
        assert.equal(camera.viewHeld, true);
      });

      it('places a link camera and reads it back; a held view has no orbit link', async () => {
        const { engine } = await boot();
        const { camera } = engine;
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

      it('measures a pull-based framing source when it frames', async () => {
        const { engine } = await boot();
        let asked = 0;
        engine.camera.setFramingSource(() => {
          asked++;
          return { inset: { bottom: 120 }, scale: { horizontal: 1, vertical: 1 } };
        });
        engine.camera.applyView('left');
        assert.ok(asked > 0);
      });

      it('shrinks the visible rectangle for the sheet, and says so', async () => {
        const { engine } = await boot();
        const { camera } = engine;
        const viewports = collect(engine, 'viewport');
        const before = camera.visibleRect;
        assert.ok(camera.hostSize.height > 200, 'the contract needs a stage with room');
        camera.setChromeInsets({ bottom: 200 }, { settle: false });
        assert.ok(camera.visibleRect.height < before.height);
        assert.equal(viewports.at(-1)?.hostSize.height, camera.hostSize.height);
      });

      it('keeps its fit when the dock changes', async () => {
        const { engine } = await boot();
        const { camera } = engine;
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
      it('accepts the look of the app state, and a theme change', async () => {
        const { engine } = await boot();
        engine.present({ lang: 'fr', referenceOnly: false });
        engine.present({ lang: 'en', referenceOnly: false });
        engine.applyTheme('dark');
        engine.invalidate();
      });
    });

    describe('comparison', () => {
      it('outlines an overlap and clears it, and a later request overtakes an earlier one', async (test) => {
        if (!fixtures.comparison) return test.skip();
        const { engine } = await boot();
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
      it('loads on first opening and says so', async () => {
        const { engine } = await boot();
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

      it('thins the streamlines by their minimum length', async () => {
        const { engine } = await boot();
        const { tracts } = engine;
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

      it('converts a point between the scan and the surface, both ways', async () => {
        const { engine } = await boot();
        const scanner: Vec3 = [10, -20, 30];
        const surface = engine.tracts.scannerToSurface(scanner);
        assert.equal(surface.length, 3);
        const back = engine.tracts.surfaceToScanner(surface);
        back.forEach((value, axis) => assert.ok(Math.abs(value - scanner[axis]!) < 1e-6));
      });

      it('opens the MRI navigator on a canvas', async () => {
        const { engine } = await boot();
        const locations: MriLocation[] = [];
        const navigator = await engine.tracts.createMriNavigator(fixtures.canvas, (location) =>
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
      });
    });

    describe('lifecycle', () => {
      it('is disposed once, and the model says so', async () => {
        const { engine } = await boot();
        assert.equal(engine.model.disposed, false);
        engine.dispose();
        assert.equal(engine.model.disposed, true);
      });
    });
  });
}
