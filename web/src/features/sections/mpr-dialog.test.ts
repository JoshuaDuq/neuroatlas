// How the Linked MRI dialog moves the shared crosshair and opens, over the fake engine's sections
// (real clamping and validation, a synthetic scan). Fixed expected values; no legacy import.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type { Region } from '../../lib/types/index.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { createMprDialog, wheelCoordinate } from './mpr-dialog.svelte.ts';

let engine: FakeEngine;
let region: Region | undefined;
let drawn: boolean;
let select: ReturnType<typeof vi.fn<(id: string) => void>>;
let frames: (() => void)[];

function build() {
  const sections = Object.create(engine.sections, {
    sample: {
      value: (point: [number, number, number]) => ({ ...engine.sections.sample(point), region }),
    },
  });
  return createMprDialog({
    engine: { sections, model: { isRegionDrawn: () => drawn } },
    select,
  });
}

const crosshair = () => engine.sections.state.crosshair;
const nextFrame = () => frames.splice(0).forEach((run) => run());

beforeEach(async () => {
  engine = createFakeEngine({ manifest: manifest as unknown as Manifest });
  await engine.sections.load();
  region = undefined;
  drawn = true;
  select = vi.fn();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => frames.push(run));
  vi.stubGlobal('cancelAnimationFrame', () => frames.splice(0));
});
afterEach(() => vi.unstubAllGlobals());

describe('the wheel', () => {
  test.each([
    [10, 120, 9],
    [10, -3, 11],
    [-128, -1, -127],
  ])(
    'moves one millimetre a notch whatever the delta: %d with delta %d gives %d',
    (at, delta, to) => {
      expect(wheelCoordinate(at, delta)).toBe(to);
    },
  );

  test.each([
    [128, -5],
    [-128, 50],
    [0, 0],
  ])('leaves the event to the page when it cannot move: %d with delta %d', (at, delta) => {
    expect(wheelCoordinate(at, delta)).toBeNull();
  });

  test('moves only the axis of the panel it is over', () => {
    const mpr = build();
    engine.sections.setCrosshair([10, 20, 30]);
    expect(mpr.wheel('coronal', 100)).toBe(true);
    expect(crosshair()).toEqual([10, 19, 30]);
    expect(mpr.wheel('axial', -100)).toBe(true);
    expect(crosshair()).toEqual([10, 19, 31]);
  });

  test('reports false and moves nothing at the end of the range', () => {
    const mpr = build();
    engine.sections.setCrosshair([128, 0, 0]);
    expect(mpr.wheel('sagittal', -1)).toBe(false);
    expect(crosshair()).toEqual([128, 0, 0]);
  });
});

describe('a slider', () => {
  test('moves the crosshair on its axis once a frame, to the latest value', () => {
    const mpr = build();
    engine.sections.setCrosshair([1, 2, 3]);
    mpr.moveTo('axial', 40);
    mpr.moveTo('axial', 41);
    mpr.moveTo('axial', 42);
    expect(crosshair()).toEqual([1, 2, 3]);
    nextFrame();
    expect(crosshair()).toEqual([1, 2, 42]);
  });

  test('two sliders moved in one frame both land', () => {
    const mpr = build();
    mpr.moveTo('sagittal', 5);
    mpr.moveTo('coronal', -6);
    nextFrame();
    expect(crosshair()).toEqual([5, -6, 0]);
  });

  test('window and level set in one frame arrive together; the one not moved keeps its value', () => {
    const mpr = build();
    const was = engine.sections.display!;
    mpr.setWindow({ width: 150 });
    mpr.setWindow({ center: 80 });
    nextFrame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 150, windowCenter: 80 });
    mpr.setWindow({ width: 120 });
    nextFrame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 120, windowCenter: 80 });
    expect(was.windowWidth).not.toBe(120);
  });

  test('a disposed dialog runs nothing that was waiting', () => {
    const mpr = build();
    mpr.moveTo('axial', 40);
    mpr.dispose();
    nextFrame();
    expect(crosshair()).toEqual([0, 0, 0]);
  });
});

describe('a click on a picture', () => {
  test('places the crosshair at the point under it, in the plane through the crosshair', () => {
    const mpr = build();
    engine.sections.setCrosshair([0, 0, 12]);
    const { fieldOfView } = engine.sections.display!;
    mpr.place('axial', 0.75, 0.25);
    expect(crosshair()).toEqual([fieldOfView / 4, fieldOfView / 4, 12]);
  });
});

describe('the region under the crosshair', () => {
  const found = { id: 'ctx-lh-1' } as Region;

  test('becomes the selection when it is drawn', () => {
    region = found;
    build().wheel('axial', 1);
    expect(select).toHaveBeenCalledExactlyOnceWith('ctx-lh-1');
  });

  test('does not, when its mesh is hidden: the MRI shows the whole volume', () => {
    region = found;
    drawn = false;
    build().wheel('axial', 1);
    expect(select).not.toHaveBeenCalled();
  });

  test('does not, where no region is', () => {
    build().wheel('axial', 1);
    expect(select).not.toHaveBeenCalled();
  });
});

describe('opening', () => {
  test("show opens, and carries the opener's keyboard activation to the transition", () => {
    const mpr = build();
    mpr.show({ instant: true });
    expect(mpr.isOpen()).toBe(true);
    expect(mpr.instant).toBe(true);
  });

  test('close from the keyboard is instant', () => {
    const mpr = build();
    mpr.show({ instant: false });
    mpr.close({ instant: true });
    expect(mpr.isOpen()).toBe(false);
    expect(mpr.instant).toBe(true);
  });

  test("a lesson's plane opens on that plane, animated", async () => {
    const mpr = build();
    await mpr.openPreparedPlane('coronal', () => true);
    expect(mpr.isOpen()).toBe(true);
    expect(mpr.plane).toBe('coronal');
    expect(mpr.instant).toBe(false);
  });

  test('a lesson step that moved on while the scan loaded opens nothing', async () => {
    const mpr = build();
    await mpr.openPreparedPlane('sagittal', () => false);
    expect(mpr.isOpen()).toBe(false);
    expect(mpr.plane).toBe('axial');
  });

  test('an unknown plane is an error, not a guess', async () => {
    await expect(build().openPreparedPlane('oblique' as 'axial', () => true)).rejects.toThrow(
      'Unknown MRI plane: oblique',
    );
  });
});
