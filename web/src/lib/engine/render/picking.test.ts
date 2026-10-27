import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { EventDispatcher, PerspectiveCamera, Raycaster } from 'three';
import type { Vector3 } from 'three';
import { createPicker } from './picking.ts';

/*
 * The browser paints between a pointer move and the raycast it schedules, so
 * the frames are held and run by hand: a test that never ran one would pass
 * against a picker that never scheduled anything.
 */
function frames() {
  const queued: (FrameRequestCallback | null)[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => queued.push(callback));
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    queued[handle - 1] = null;
  });
  return {
    run() {
      for (const callback of queued.splice(0)) callback?.(0);
    },
  };
}

type Listener = (event: unknown) => void;

function canvas(rect = { left: 0, top: 0, width: 200, height: 100 }) {
  const listeners = new Map<string, Listener>();
  return {
    style: { cursor: '' },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    getBoundingClientRect: () => rect,
    emit(type: string, event: Record<string, unknown> = {}) {
      listeners.get(type)?.({
        clientX: 100,
        clientY: 50,
        buttons: 0,
        pointerType: 'mouse',
        isPrimary: true,
        ...event,
      });
    },
  };
}

type Region = { id: string };

function picker() {
  const region = { id: 'destrieux:left:1' };
  const asked: unknown[] = [];
  const hovered: unknown[][] = [];
  const domElement = canvas();
  const controls = new EventDispatcher<{ change: object }>();
  const instance = createPicker<Region>({
    domElement: domElement as unknown as HTMLElement,
    controls: controls as never,
    camera: new PerspectiveCamera(),
    model: () => ({
      pick: (raycaster) => {
        asked.push(raycaster);
        return region;
      },
    }),
    onHover: (...args) => hovered.push(args),
    onSelect: () => {},
  });
  return { domElement, controls, instance, asked, hovered, region };
}

function selecting(pick: () => Region | null) {
  const domElement = canvas();
  const chosen: string[] = [];
  createPicker<Region>({
    domElement: domElement as unknown as HTMLElement,
    camera: new PerspectiveCamera(),
    model: () => ({ pick }),
    onSelect: (id) => chosen.push(id),
  });
  return { domElement, chosen };
}

describe('picker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names what the pointer is over without being clicked', () => {
    const clock = frames();
    const { domElement, hovered, region } = picker();
    domElement.emit('pointermove', { clientX: 120, clientY: 40 });
    clock.run();
    assert.deepEqual(hovered, [[region, { x: 120, y: 40 }]]);
  });

  it('never hovers for a finger: it is pressing or it is absent', () => {
    const clock = frames();
    const { domElement, asked } = picker();
    domElement.emit('pointermove', { pointerType: 'touch' });
    clock.run();
    assert.deepEqual(asked, []);
  });

  it('does not interrupt an orbit to name what it passes over', () => {
    const clock = frames();
    const { domElement, asked } = picker();
    domElement.emit('pointermove', { buttons: 1 });
    clock.run();
    assert.deepEqual(asked, []);
  });

  it('asks the anatomy once a frame however far the pointer travelled', () => {
    const clock = frames();
    const { domElement, asked } = picker();
    for (let x = 0; x < 20; x++) domElement.emit('pointermove', { clientX: x });
    clock.run();
    assert.equal(asked.length, 1);
  });

  it('takes the name away when the pointer leaves the canvas', () => {
    const clock = frames();
    const { domElement, hovered } = picker();
    domElement.emit('pointermove');
    clock.run();
    domElement.emit('pointerleave');
    assert.deepEqual(hovered.at(-1), [null, null]);
  });

  it('selects the region under a click', () => {
    const { domElement, chosen } = selecting(() => ({ id: 'destrieux:left:1' }));
    domElement.emit('pointerdown', { button: 0 });
    domElement.emit('pointerup', { button: 0 });
    assert.deepEqual(chosen, ['destrieux:left:1']);
  });

  it('while placing, a click hands over the point it meets instead of choosing a region', () => {
    const domElement = canvas();
    const chosen: string[] = [];
    const placed: Vector3[] = [];
    let placing = true;
    const point = { x: 0.01, y: 0.02, z: 0.03 } as Vector3;
    createPicker<Region>({
      domElement: domElement as unknown as HTMLElement,
      camera: new PerspectiveCamera(),
      model: () => ({ pick: () => ({ id: 'destrieux:left:1' }), intersect: () => ({ point }) }),
      onSelect: (id) => chosen.push(id),
      placing: () => placing,
      onPlace: (at) => placed.push(at),
    });
    domElement.emit('pointerdown', { button: 0 });
    domElement.emit('pointerup', { button: 0 });
    assert.deepEqual([placed, chosen], [[point], []]);
    placing = false;
    domElement.emit('pointerdown', { button: 0 });
    domElement.emit('pointerup', { button: 0 });
    assert.deepEqual([placed, chosen], [[point], ['destrieux:left:1']]);
  });

  it('does not clear the selection on a click on the empty stage', () => {
    const { domElement, chosen } = selecting(() => null);
    domElement.emit('pointerdown', { button: 0 });
    domElement.emit('pointerup', { button: 0 });
    assert.deepEqual(chosen, []);
  });

  it('reads a touch that drifted up to the platform slop as a tap, and a mouse only up to five pixels', () => {
    const { domElement, chosen } = selecting(() => ({ id: 'a' }));
    const press = (pointerType: string, drift: number) => {
      domElement.emit('pointerdown', { button: 0, pointerType, clientX: 100 });
      domElement.emit('pointerup', { button: 0, pointerType, clientX: 100 + drift });
    };
    press('touch', 11);
    press('touch', 12);
    press('mouse', 4);
    press('mouse', 5);
    assert.equal(chosen.length, 2);
  });

  it('triggers focus on the 3D coordinate under a double click', () => {
    const domElement = canvas();
    const targetPoint = { x: 0, y: -0.25, z: 0.05 } as Vector3;
    let focused: Vector3 | null = null;
    createPicker<Region>({
      domElement: domElement as unknown as HTMLElement,
      camera: new PerspectiveCamera(),
      model: () => ({ pick: () => null, intersect: () => ({ point: targetPoint }) }),
      onHover: () => {},
      onSelect: () => {},
      onFocusPoint: (point) => {
        focused = point;
      },
    });
    domElement.emit('dblclick', { clientX: 100, clientY: 50 });
    assert.deepEqual(focused, targetPoint);
  });

  it('clears a stale hover once on a camera move, without selecting anything', () => {
    const clock = frames();
    const { domElement, controls, hovered } = picker();
    domElement.emit('pointermove');
    clock.run();
    controls.dispatchEvent({ type: 'change' });
    controls.dispatchEvent({ type: 'change' });
    assert.deepEqual(hovered.at(-1), [null, null]);
    assert.equal(hovered.length, 2);
  });

  it('cancels a hover queued before the orbit', () => {
    const clock = frames();
    const { domElement, controls, asked } = picker();
    domElement.emit('pointermove');
    controls.dispatchEvent({ type: 'change' });
    clock.run();
    assert.equal(asked.length, 0);
  });

  it('picks at the latest pointer position when moves coalesce', () => {
    const clock = frames();
    const { domElement, hovered } = picker();
    domElement.emit('pointermove', { clientX: 20 });
    domElement.emit('pointermove', { clientX: 120 });
    clock.run();
    assert.equal((hovered[0]![1] as { x: number }).x, 120);
  });

  it('removes its camera listener on dispose', () => {
    const clock = frames();
    const { domElement, controls, instance, hovered } = picker();
    domElement.emit('pointermove');
    clock.run();
    instance.dispose();
    controls.dispatchEvent({ type: 'change' });
    assert.equal(hovered.length, 1);
  });

  it('clears the hover cursor on camera motion without overriding an active grab', () => {
    const clock = frames();
    const { domElement, controls } = picker();
    domElement.emit('pointermove');
    clock.run();
    assert.equal(domElement.style.cursor, 'pointer');
    controls.dispatchEvent({ type: 'change' });
    assert.equal(domElement.style.cursor, 'grab');
    domElement.style.cursor = 'grabbing';
    controls.dispatchEvent({ type: 'change' });
    assert.equal(domElement.style.cursor, 'grabbing');
  });

  it('cancels the tap when a second finger lands, even if it lifts first', () => {
    const { domElement, chosen } = selecting(() => ({ id: 'a' }));
    const touch = { button: 0, pointerType: 'touch' };
    domElement.emit('pointerdown', { ...touch, pointerId: 1, clientX: 20 });
    domElement.emit('pointerdown', { ...touch, pointerId: 2, isPrimary: false, clientX: 180 });
    domElement.emit('pointerup', { ...touch, pointerId: 2, isPrimary: false, clientX: 180 });
    domElement.emit('pointerup', { ...touch, pointerId: 1, clientX: 20 });
    assert.deepEqual(chosen, []);
  });

  it('does not read a pinch whose first finger lifts first as a tap', () => {
    const { domElement, chosen } = selecting(() => ({ id: 'a' }));
    const touch = { button: 0, pointerType: 'touch' };
    domElement.emit('pointerdown', { ...touch, pointerId: 1, clientX: 20 });
    domElement.emit('pointerdown', { ...touch, pointerId: 2, isPrimary: false, clientX: 120 });
    domElement.emit('pointermove', { ...touch, pointerId: 2, isPrimary: false, clientX: 190 });
    domElement.emit('pointerup', { ...touch, pointerId: 1, clientX: 118 });
    assert.deepEqual(chosen, []);
  });
});

describe('pick ray and cursor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SCENE-15 the cursor is pointer over a region and grab elsewhere', () => {
    const clock = frames();
    let region: Region | null = { id: 'destrieux:left:1' };
    const domElement = canvas();
    createPicker<Region>({
      domElement: domElement as unknown as HTMLElement,
      camera: new PerspectiveCamera(),
      model: () => ({ pick: () => region }),
      onSelect: () => {},
    });
    domElement.emit('pointermove');
    clock.run();
    assert.equal(domElement.style.cursor, 'pointer');
    region = null;
    domElement.emit('pointermove');
    clock.run();
    assert.equal(domElement.style.cursor, 'grab');
  });

  it('SCENE-24 the ray passes through the pointer, measured from the canvas corner', () => {
    const camera = new PerspectiveCamera(35, 2, 0.01, 10);
    camera.position.set(0.1, 0.2, 0.5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const domElement = canvas({ left: 10, top: 5, width: 200, height: 100 });
    const rays: Raycaster['ray'][] = [];
    const clock = frames();
    createPicker<Region>({
      domElement: domElement as unknown as HTMLElement,
      camera,
      model: () => ({
        pick: (raycaster) => {
          rays.push(raycaster.ray.clone());
          return null;
        },
      }),
      onSelect: () => {},
    });
    const through = (clientX: number, clientY: number, x: number, y: number) => {
      domElement.emit('pointermove', { clientX, clientY });
      clock.run();
      const expected = new Raycaster();
      expected.setFromCamera({ x, y } as never, camera);
      const ray = rays.at(-1)!;
      assert.ok(ray.origin.distanceTo(expected.ray.origin) < 1e-12);
      assert.ok(ray.direction.distanceTo(expected.ray.direction) < 1e-12);
    };
    // The canvas centre is NDC (0, 0), and its top-left corner is (-1, 1).
    through(110, 55, 0, 0);
    through(10, 5, -1, 1);
    through(210, 105, 1, -1);
  });

  it('SCENE-24 a canvas with no size picks nothing', () => {
    const clock = frames();
    const domElement = canvas({ left: 0, top: 0, width: 0, height: 0 });
    const pick = vi.fn(() => ({ id: 'destrieux:left:1' }));
    const hovered = vi.fn();
    const selected = vi.fn();
    createPicker<Region>({
      domElement: domElement as unknown as HTMLElement,
      camera: new PerspectiveCamera(),
      model: () => ({ pick }),
      onHover: hovered,
      onSelect: selected,
    });
    domElement.emit('pointermove');
    clock.run();
    domElement.emit('pointerdown', { button: 0 });
    domElement.emit('pointerup', { button: 0 });
    assert.equal(pick.mock.calls.length, 0);
    assert.equal(selected.mock.calls.length, 0);
    assert.ok(hovered.mock.calls.every(([region]) => region === null));
  });
});
