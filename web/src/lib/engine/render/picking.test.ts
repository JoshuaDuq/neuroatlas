import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { EventDispatcher, PerspectiveCamera } from 'three';
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

function canvas() {
  const listeners = new Map<string, Listener>();
  return {
    style: { cursor: '' },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
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
