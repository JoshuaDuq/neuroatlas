import assert from 'node:assert/strict';
import { describe, expect, test, vi } from 'vitest';
import { createScene } from './excursion-test-support.ts';
import type { Scene } from './excursion-test-support.ts';

const firstCircuit = (scene: Scene) => scene.circuits.all[0]!;

describe('opening a lesson', () => {
  test('holds the scene, shows the detail, draws and frames the first landmark, then starts', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    const [first] = circuit.steps;
    const mark = scene.engine.calls.length;
    await scene.excursions.openCircuit(circuit.id);

    assert.equal(scene.reader.capture.mock.calls.length, 1);
    assert.deepEqual(scene.lesson.state, { circuit: circuit.id, step: 0, visited: [0] });
    assert.equal(scene.engine.model.state.selectedRegion?.id, first!.region);
    const timeline = scene.calls(mark);
    assert.equal(timeline[0], 'shell.showDetail');
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameLandmark')!;
    assert.deepEqual(framed.args, [first!.region, first!.view, scene.circuits.contextMarginMm, {}]);
    assert.equal(scene.session.state.view, first!.view);
    assert.equal(timeline.at(-1), 'app.render');
  });

  test('a lesson already open keeps the scene it holds', async () => {
    const scene = createScene();
    const [one, two] = scene.circuits.all;
    await scene.excursions.openCircuit(one!.id);
    await scene.excursions.openCircuit(two!.id);
    assert.equal(scene.reader.capture.mock.calls.length, 1);
  });

  test('a landmark whose geometry is not drawn is refused, not framed', async () => {
    const scene = createScene();
    vi.spyOn(scene.engine.camera, 'frameLandmark').mockReturnValue(false);
    await expect(scene.excursions.openCircuit(firstCircuit(scene).id)).rejects.toThrow(
      /Landmark geometry unavailable/,
    );
    assert.equal(scene.lesson.state.circuit, null);
  });

  test('a command that overtakes it stops it before it frames or starts', async () => {
    const scene = createScene();
    const opening = scene.excursions.openCircuit(firstCircuit(scene).id);
    scene.commands.begin();
    await opening;
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'frameLandmark'),
      false,
    );
  });

  test('another panel’s related lesson opens on its landmark in the Circuits tab', async () => {
    const scene = createScene();
    const circuit = scene.circuits.all.find((entry) => entry.steps.length > 2)!;
    await scene.excursions.openLessonLandmark(circuit.id, 2);
    assert.equal(scene.session.state.explorer, 'circuits');
    assert.deepEqual(scene.lesson.state, { circuit: circuit.id, step: 2, visited: [0, 2] });
    assert.equal(scene.engine.model.state.selectedRegion?.id, circuit.steps[2]!.region);
  });

  test('a step moves the lesson; one that does not exist is refused', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    await scene.excursions.openCircuit(circuit.id);
    scene.session.setExplorer('circuits');
    const mark = scene.engine.calls.length;
    await scene.excursions.openLessonStep(1);
    assert.equal(scene.lesson.state.step, 1);
    assert.equal(scene.engine.model.state.selectedRegion?.id, circuit.steps[1]!.region);
    assert.deepEqual(scene.calls(mark).slice(-2), ['app.render', 'shell.showDetail']);

    await expect(scene.excursions.openLessonStep(circuit.steps.length)).rejects.toThrow(RangeError);
    assert.equal(scene.lesson.state.step, 1);
  });

  test('the landmark in front is the lesson step whose region is selected', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    assert.equal(scene.excursions.lessonLandmark(), null);
    await scene.excursions.openCircuit(circuit.id);
    assert.equal(scene.excursions.lessonLandmark(), null, 'not on the Circuits tab');
    scene.session.setExplorer('circuits');
    assert.equal(scene.excursions.lessonLandmark(), circuit.steps[0]);
    scene.engine.model.select(null);
    assert.equal(scene.excursions.lessonLandmark(), null);
  });
});

describe('leaving a lesson', () => {
  async function inLesson(scene: Scene) {
    await scene.excursions.openCircuit(firstCircuit(scene).id);
    scene.session.setExplorer('circuits');
  }

  test('ends it and puts back the scene from before it, with the list in front', async () => {
    const scene = createScene();
    await inLesson(scene);
    const held = scene.reader.capture.mock.results[0]!.value;
    const mark = scene.engine.calls.length;
    await scene.excursions.leaveLesson();

    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.apply.mock.calls[0]![0], held);
    assert.deepEqual(scene.calls(mark), ['app.render', 'shell.showList', 'app.render']);
  });

  test('a lesson a link opened on its landmark has no earlier scene to put back', async () => {
    const scene = createScene();
    await inLesson(scene);
    scene.excursions.forget();
    await scene.excursions.leaveLesson();
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.apply.mock.calls.length, 0);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'showList'),
      false,
    );
  });

  test('is nothing when no lesson is open, or its tab is not in front', async () => {
    const scene = createScene();
    await scene.excursions.leaveLesson();
    await scene.excursions.openCircuit(firstCircuit(scene).id);
    await scene.excursions.leaveLesson();
    assert.equal(scene.lesson.state.circuit !== null, true);
    assert.equal(scene.reader.apply.mock.calls.length, 0);
  });

  test('tells the reader what the restore could not put back', async () => {
    const scene = createScene();
    await inLesson(scene);
    const error = new Error('atlas failed');
    scene.reader.apply.mockImplementationOnce(async () => [{ fields: ['atlas'], error }]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await scene.excursions.leaveLesson();
    assert.ok(scene.session.state.notice?.text);
    assert.equal(scene.lesson.state.circuit, null);
  });

  test('a later command that took over leaves the list where it is', async () => {
    const scene = createScene();
    await inLesson(scene);
    scene.reader.apply.mockImplementationOnce(async () => {
      scene.commands.begin();
      return [];
    });
    await scene.excursions.leaveLesson();
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'showList'),
      false,
    );
  });
});

describe('the Linked MRI', () => {
  test('centres on the selected region from its own button, wherever the crosshair was', async () => {
    const scene = createScene();
    await scene.commands.openRegion('destrieux:left:25', scene.commands.begin());
    scene.engine.model.select('destrieux:left:25');
    scene.engine.sections.setCrosshair([1, 2, 3]);
    const centroid = scene.engine.model.centroidOf('destrieux:left:25')!;
    await scene.excursions.openLinkedMri({ atRegion: true, instant: true });
    assert.deepEqual(scene.engine.sections.state.crosshair, centroid);
    assert.deepEqual(scene.mri.show.mock.calls[0], [{ instant: true }]);
    const timeline = scene.calls();
    assert.ok(timeline.lastIndexOf('sections.load') < timeline.lastIndexOf('mri.show'));
  });

  test('from the cut bar, moves to the selected region only from the origin', async () => {
    const scene = createScene();
    await scene.commands.openRegion('destrieux:left:25', scene.commands.begin());
    const centroid = scene.engine.model.centroidOf('destrieux:left:25')!;
    scene.engine.sections.setCrosshair([1, 2, 3]);
    await scene.excursions.openLinkedMri();
    assert.deepEqual(scene.engine.sections.state.crosshair, [1, 2, 3]);

    scene.engine.sections.setCrosshair([0, 0, 0]);
    await scene.excursions.openLinkedMri();
    assert.deepEqual(scene.engine.sections.state.crosshair, centroid);
    assert.deepEqual(scene.mri.show.mock.calls.at(-1), [{ instant: false }]);
  });

  test('with no selection it opens where the crosshair is', async () => {
    const scene = createScene();
    await scene.excursions.openLinkedMri({ atRegion: true });
    assert.deepEqual(scene.engine.sections.state.crosshair, [0, 0, 0]);
    assert.equal(scene.mri.show.mock.calls.length, 1);
  });

  test('under a lesson, a landmark’s own button opens the lesson’s prepared plane instead', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    const [step] = circuit.steps;
    await scene.excursions.openCircuit(circuit.id);
    scene.session.setExplorer('circuits');
    const mark = scene.engine.calls.length;
    await scene.excursions.openLinkedMri({ atRegion: true, instant: true });
    await scene.settled();

    assert.equal(scene.panels.openMri.mock.calls.length, 1);
    assert.equal(scene.mri.show.mock.calls.length, 0);
    assert.deepEqual(scene.mri.openPreparedPlane.mock.calls[0]!.slice(0, 1), [step!.plane]);
    const timeline = scene.calls(mark);
    assert.deepEqual(
      timeline.filter((call) => /setCrosshair|setDisplay|setMode|faceCut|openPrepared/.test(call)),
      [
        'sections.setMode',
        'sections.setCrosshair',
        'sections.setDisplay',
        'sections.setMode',
        'camera.faceCut',
        'mri.openPreparedPlane',
      ],
    );
    // faceCut ends with a render, as legacy's does, before the plane opens.
    assert.equal(timeline[timeline.indexOf('camera.faceCut') + 1], 'app.render');
    assert.deepEqual(
      scene.engine.sections.state.crosshair,
      scene.engine.model.centroidOf(step!.region),
    );
    assert.equal(scene.engine.sections.state.mode, step!.plane);
    assert.equal(scene.engine.sections.state.overlay, true);
  });

  test('the prepared plane waits for nothing a reader has moved on from', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    await scene.excursions.openCircuit(circuit.id);
    scene.session.setExplorer('circuits');
    scene.mri.openPreparedPlane.mockImplementationOnce(async (_plane, canOpen) => {
      assert.equal(canOpen(), true);
      await scene.excursions.openLessonStep(1);
      assert.equal(canOpen(), false);
    });
    await scene.excursions.openLinkedMri({ atRegion: true });
    await scene.settled();
    assert.equal(scene.lesson.state.step, 1);
  });

  test('a lesson’s MRI stops where the reader left the Circuits tab', async () => {
    const scene = createScene();
    await scene.excursions.openCircuit(firstCircuit(scene).id);
    scene.session.setExplorer('circuits');
    await scene.excursions.openLinkedMri({ atRegion: true });
    scene.session.setExplorer('anatomy');
    await scene.settled();
    assert.equal(scene.mri.openPreparedPlane.mock.calls.length, 0);
  });
});

describe('focusing the open landmark', () => {
  test('frames it as the lesson authored it, with the move options, and renders', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    await scene.excursions.openCircuit(circuit.id);
    scene.session.setExplorer('circuits');
    const mark = scene.engine.calls.length;
    assert.equal(scene.excursions.focusLandmark({ immediate: true }), true);
    const framed = scene.engine.calls.slice(mark).find((call) => call.method === 'frameLandmark')!;
    const [step] = circuit.steps;
    assert.deepEqual(framed.args, [
      step!.region,
      step!.view,
      scene.circuits.contextMarginMm,
      { immediate: true },
    ]);
    assert.equal(scene.calls(mark).at(-1), 'app.render');
  });

  test('is false, and frames nothing, with no lesson landmark selected', async () => {
    const scene = createScene();
    assert.equal(scene.excursions.focusLandmark(), false);
    await scene.commands.openRegion('destrieux:left:25', scene.commands.begin());
    assert.equal(scene.excursions.focusLandmark(), false);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'frameLandmark'),
      false,
    );
  });
});
